from django.urls import path
from . import views

urlpatterns = [
    # Authentication
    path("login/", views.user_login, name="login"),
    path("logout/", views.user_logout, name="logout"),
    
    # Main sensor tree visualization
    path("sensor-tree/", views.sensor_tree_view, name="sensor-tree"),
    
    # Tree views and API
    path("tree/", views.tree_view, name="tree-view"),
    path("tree/data/", views.get_tree_data, name="tree-data"),
    path("tree/from-file/", views.tree_from_file, name="tree-from-file"),
    path("tree/upload/", views.upload_excel_view, name="upload-excel-view"),  # For viewing only
    path("tree/upload-permanent/", views.upload_excel, name="upload-excel"),  # For permanent database save
    path("tree/ping/", views.ping, name="ping"),
    
    # Notes
    path("notes/<path:node_id>/", views.NoteEditorView.as_view(), name="note-editor"),
]
