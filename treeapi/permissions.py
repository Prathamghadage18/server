"""
Custom permissions and decorators for RBAC implementation.
"""
from functools import wraps
from django.http import JsonResponse, HttpResponseForbidden
from django.shortcuts import redirect
from django.contrib.auth.decorators import login_required
from rest_framework import permissions
from .models import AllowedUser


def superuser_required(view_func):
    """
    Decorator that ensures only superusers can access the view.
    """
    @wraps(view_func)
    @login_required
    def wrapper(request, *args, **kwargs):
        if not request.user.is_superuser:
            return HttpResponseForbidden("Only superusers can access this page.")
        return view_func(request, *args, **kwargs)
    return wrapper


def allowed_user_required(view_func):
    """
    Decorator that ensures only allowed users (predefined normal users + superusers) can access.
    """
    @wraps(view_func)
    @login_required
    def wrapper(request, *args, **kwargs):
        # Superusers always allowed
        if request.user.is_superuser:
            return view_func(request, *args, **kwargs)
        
        # Check if user is in allowed users list
        if AllowedUser.objects.filter(user=request.user).exists():
            return view_func(request, *args, **kwargs)
        
        return HttpResponseForbidden("You are not authorized to access this page.")
    return wrapper


def can_delete_node(user):
    """
    Check if user can delete nodes.
    Only superusers can delete nodes.
    """
    return user.is_superuser


def can_modify_note(user):
    """
    Check if user can modify notes.
    Both superusers and normal users can modify notes.
    """
    return user.is_authenticated


def can_modify_node(user):
    """
    Check if user can modify nodes (excluding deletion).
    Both superusers and normal users can modify nodes.
    """
    return user.is_authenticated


# Django REST Framework Permissions

class IsSuperUserOrReadOnly(permissions.BasePermission):
    """
    Custom permission: Only superusers can modify, others can only read.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        return request.user.is_superuser


class CanModifyNote(permissions.BasePermission):
    """
    Custom permission for Note operations.
    - Superusers: Full CRUD
    - Normal users: Full CRUD
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated


class CanModifyNode(permissions.BasePermission):
    """
    Custom permission for Node operations.
    - Superusers: Full CRUD
    - Normal users: CRU (no delete)
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # DELETE operation only for superusers
        if request.method == 'DELETE':
            return request.user.is_superuser
        
        return True


class IsAllowedUser(permissions.BasePermission):
    """
    Permission class to check if user is in allowed users list or is superuser.
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
        
        return AllowedUser.objects.filter(user=request.user).exists()
