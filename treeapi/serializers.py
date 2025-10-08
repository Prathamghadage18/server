from rest_framework import serializers

class ExcelPathSerializer(serializers.Serializer):
    path = serializers.CharField(required=False, allow_blank=True)
    excel_path = serializers.CharField(required=False, allow_blank=True)
    sheet = serializers.IntegerField(required=False)

class UploadSerializer(serializers.Serializer):
    file = serializers.FileField()
