from django.http import JsonResponse, HttpResponseForbidden
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
import os
from .utils import build_tree_from_excel, populate_nodes_from_excel
from rest_framework.decorators import api_view
from .serializers import UploadSerializer
from django.views.generic import FormView
from urllib.parse import unquote
from .models import Node, Note, ExcelUploadTracker, AllowedUser
from .forms import NoteForm
from django.views.decorators.csrf import ensure_csrf_cookie
from .permissions import superuser_required, allowed_user_required, can_delete_node

@ensure_csrf_cookie
@allowed_user_required
def sensor_tree_view(request):
    """
    Main view: renders the sensor tree visualization template.
    Protected - only allowed users can access.
    """
    return render(request, 'sensor_tree.html', {
        'user': request.user,
        'is_superuser': request.user.is_superuser
    })

@login_required
def tree_from_file(request):
    """
    API endpoint: returns tree JSON from Excel file.
    Path is read from .env (EXCEL_DEFAULT_PATH).
    Protected - requires authentication.
    """
    excel_path = os.getenv("EXCEL_DEFAULT_PATH")
    if not excel_path:
        return JsonResponse({"error": "EXCEL_DEFAULT_PATH not set in .env"}, status=500)

    try:
        tree = build_tree_from_excel(excel_path)
        return JsonResponse(tree, safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def ping(request):
    return JsonResponse({"status": "ok"})


def user_login(request):
    """
    Custom login view that checks if user is allowed (predefined normal user or superuser).
    Redirects to tree view on successful login.
    """
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            # Check if user is superuser or in allowed users list
            if user.is_superuser or AllowedUser.objects.filter(user=user).exists():
                login(request, user)
                messages.success(request, f'Welcome, {user.username}!')
                # Redirect to sensor tree visualization
                return redirect('sensor-tree')
            else:
                messages.error(request, 'You are not authorized to access this system.')
        else:
            messages.error(request, 'Invalid username or password.')
    
    return render(request, 'login.html')


def user_logout(request):
    """
    Logout view.
    """
    logout(request)
    messages.success(request, 'You have been logged out successfully.')
    return redirect('login')


@login_required
def tree_view(request):
    """
    Tree view that displays hierarchical structure of nodes.
    Shows tree on login with proper permissions.
    """
    # Check if user is allowed
    if not request.user.is_superuser and not AllowedUser.objects.filter(user=request.user).exists():
        return HttpResponseForbidden("You are not authorized to access this page.")
    
    return render(request, 'tree_view.html', {
        'user': request.user,
        'is_superuser': request.user.is_superuser
    })


@login_required
def get_tree_data(request):
    """
    API endpoint to get HIERARCHICAL tree data from database.
    Builds tree structure from saved Node records.
    Both superusers and normal users can see the uploaded tree.
    """
    # Check if user is allowed
    if not request.user.is_superuser and not AllowedUser.objects.filter(user=request.user).exists():
        return JsonResponse({"error": "Not authorized"}, status=403)
    
    try:
        # Get all nodes from database
        node_ids = Node.objects.all().values_list('node_id', flat=True)
        
        if not node_ids:
            return JsonResponse({
                "id": "root",
                "name": "root",
                "children": [],
                "message": "No data in database. Superuser must upload Excel file first."
            }, safe=False)
        
        # Build hierarchical tree structure from node_ids (like Excel format)
        # The root wrapper will be unwrapped by normalizeData.js
        tree = {
            "id": "root", 
            "name": "root", 
            "type": "root",  # Mark as root type so normalizeData.js can unwrap it
            "children": []
        }
        
        for node_id in node_ids:
            # Split node_id by '/' to get hierarchy
            parts = node_id.split('/')
            
            # Navigate/create tree structure
            current = tree
            for i, part in enumerate(parts):
                if "children" not in current:
                    current["children"] = []
                
                # Find or create child node
                child = next((c for c in current["children"] if c["name"] == part), None)
                if not child:
                    full_id = "/".join(parts[:i+1])
                    # Determine node type based on level
                    node_type = "sensor" if i == len(parts) - 1 else [
                        "manufacturer", "segment", "site", "plant",
                        "function", "system", "machine", "stage"
                    ][min(i, 7)]
                    
                    child = {
                        "id": full_id,
                        "name": part,
                        "type": node_type,
                        "children": []
                    }
                    
                    # Only add status to sensor nodes (leaf nodes)
                    if node_type == "sensor":
                        child["status"] = "online"
                    
                    current["children"].append(child)
                
                current = child
        
        return JsonResponse(tree, safe=False)
    
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@api_view(['POST'])
@login_required
def upload_excel_view(request):
    """
    API endpoint: Upload Excel file for VIEWING only (doesn't save to database).
    All authenticated users can use this to visualize tree structure.
    """
    serializer = UploadSerializer(data=request.data)
    if serializer.is_valid():
        file = serializer.validated_data['file']
        try:
            # Build tree but DON'T populate database - just for visualization
            tree = build_tree_from_excel(file)
            return JsonResponse(tree, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    return JsonResponse(serializer.errors, status=400)


@api_view(['POST'])
def upload_excel(request):
    """
    API endpoint: accepts Excel file upload, processes it, returns tree JSON.
    ONE-TIME ONLY for superusers - This SAVES to database permanently.
    """
    # Check if user is superuser
    if not request.user.is_superuser:
        return JsonResponse({"error": "Only superusers can upload Excel files to database."}, status=403)
    
    # Check if already uploaded
    upload_status = ExcelUploadTracker.objects.first()
    if upload_status and upload_status.is_uploaded:
        return JsonResponse({
            "error": "Excel file has already been uploaded. Re-upload is not allowed.",
            "uploaded_at": upload_status.uploaded_at,
            "uploaded_by": upload_status.uploaded_by.username if upload_status.uploaded_by else "Unknown"
        }, status=400)
    
    serializer = UploadSerializer(data=request.data)
    if serializer.is_valid():
        file = serializer.validated_data['file']
        try:
            # Build tree and populate database
            tree = build_tree_from_excel(file)
            populate_nodes_from_excel(file)
            
            # Mark as uploaded
            if not upload_status:
                upload_status = ExcelUploadTracker()
            upload_status.is_uploaded = True
            upload_status.uploaded_by = request.user
            upload_status.file_name = file.name
            upload_status.save()
            
            return JsonResponse({
                "success": True,
                "message": "Excel file uploaded successfully. No further uploads allowed.",
                "tree": tree
            }, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    return JsonResponse(serializer.errors, status=400)


class NoteEditorView(FormView):
    template_name = 'note_editor.html'
    form_class = NoteForm

    def _decoded_node_id(self) -> str:
        raw = self.kwargs.get('node_id', '')
        return unquote(raw)

    def get_success_url(self):
        # stay on same page after save
        return self.request.path

    def get_initial(self):
        initial = super().get_initial()
        node_id = self._decoded_node_id()
        node, _ = Node.objects.get_or_create(node_id=node_id)
        note = getattr(node, 'note', None)
        if note:
            initial['content'] = note.content_without_timestamp()
        else:
            initial['content'] = ''
        return initial

    def dispatch(self, request, *args, **kwargs):
        # Check if user is authenticated
        if not request.user.is_authenticated:
            return redirect('login')
        
        # Check if user is allowed
        if not request.user.is_superuser and not AllowedUser.objects.filter(user=request.user).exists():
            return HttpResponseForbidden("You are not authorized to access this page.")
        
        return super().dispatch(request, *args, **kwargs)
    
    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        node_id = self._decoded_node_id()
        node, _ = Node.objects.get_or_create(node_id=node_id)
        note = getattr(node, 'note', None)
        ctx['node'] = node
        ctx['node_id'] = node.node_id
        ctx['note'] = note
        ctx['last_updated'] = note.updated_at if note else None
        ctx['is_superuser'] = self.request.user.is_superuser
        return ctx

    def form_valid(self, form):
        node_id = self._decoded_node_id()
        node, _ = Node.objects.get_or_create(node_id=node_id)
        content = form.cleaned_data.get('content', '')
        note, _ = Note.objects.get_or_create(node=node)
        note.content = content
        # Pass the user to the save method for tracking
        note.save(modified_by=self.request.user)
        # Re-render with success flag
        return super().form_valid(form)
