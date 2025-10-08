from django.urls import path
from . import views

urlpatterns = [
    path("tree/", views.tree_page, name="tree-page"),
    path("tree/from-file/", views.tree_from_file, name="tree-from-file"),
    path("tree/upload/", views.upload_excel, name="upload-excel"),
    path("tree/ping/", views.ping, name="ping"),
]
