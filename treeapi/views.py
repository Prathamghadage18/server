from django.http import JsonResponse
from django.conf import settings
import os
from .utils import build_tree_from_excel
from django.shortcuts import render
from rest_framework.decorators import api_view
from .serializers import UploadSerializer

def tree_from_file(request):
    """
    API endpoint: returns tree JSON from Excel file.
    Path is read from .env (EXCEL_DEFAULT_PATH).
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

def tree_page(request):
    return render(request, "tree.html")

@api_view(['POST'])
def upload_excel(request):
    """
    API endpoint: accepts Excel file upload, processes it, returns tree JSON.
    """
    serializer = UploadSerializer(data=request.data)
    if serializer.is_valid():
        file = serializer.validated_data['file']
        try:
            tree = build_tree_from_excel(file)
            return JsonResponse(tree, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    return JsonResponse(serializer.errors, status=400)
