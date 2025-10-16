from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User


class ExcelUploadTracker(models.Model):
    """
    Tracks whether Excel file has been uploaded by superuser (one-time only).
    Only one record should exist in this table.
    """
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    file_name = models.CharField(max_length=255, blank=True)
    is_uploaded = models.BooleanField(default=False)
    
    class Meta:
        verbose_name = "Excel Upload Status"
        verbose_name_plural = "Excel Upload Status"
    
    def __str__(self):
        return f"Upload status: {self.is_uploaded}"


class AllowedUser(models.Model):
    """
    Stores the 9 predefined normal users who are allowed to log in.
    Only these users (plus superusers) can access the system.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='allowed_user_profile')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Allowed User"
        verbose_name_plural = "Allowed Users"
    
    def __str__(self):
        return self.user.username


class Node(models.Model):
    node_id = models.CharField(max_length=512, unique=True)

    def __str__(self):
        return self.node_id


class Note(models.Model):
    node = models.OneToOneField(Node, on_delete=models.CASCADE, related_name="note")
    content = models.TextField(blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)
    last_modified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    def _strip_timestamp(self, value: str) -> str:
        """Strip the 'Last updated:' timestamp from content."""
        txt = (value or "").rstrip()
        lines = txt.splitlines()
        if lines and lines[-1].startswith("Last updated:"):
            lines = lines[:-1]
        return ("\n".join(lines)).rstrip("\n")
    
    def _strip_modification_metadata(self, value: str) -> str:
        """Strip modification metadata lines from content."""
        txt = (value or "").rstrip()
        lines = txt.splitlines()
        # Remove lines starting with [Modified by:
        filtered_lines = [line for line in lines if not line.strip().startswith("[Modified by:")]
        return "\n".join(filtered_lines).rstrip("\n")

    def save(self, *args, **kwargs):
        # Get the user from kwargs (passed from views)
        user = kwargs.pop('modified_by', None)
        
        # Strip existing timestamp and modification metadata
        base = self._strip_modification_metadata(self._strip_timestamp(self.content))
        
        # If modified by a normal user (not superuser), prepend modification info
        if user and not user.is_superuser:
            timestamp = timezone.localtime(timezone.now()).strftime("%Y-%m-%d %H:%M:%S IST")
            modification_line = f"[Modified by: {user.username} at {timestamp}]"
            base = modification_line + "\n" + base if base else modification_line
        
        # Add timestamp at the end
        timestamp = timezone.localtime(timezone.now()).strftime("%Y-%m-%d %H:%M IST")
        final_lines = [] if base == "" else base.splitlines()
        final_lines.append(f"Last updated: {timestamp}")
        self.content = "\n".join(final_lines) + "\n"
        
        # Store who last modified
        if user:
            self.last_modified_by = user
        
        super().save(*args, **kwargs)

    def content_without_timestamp(self) -> str:
        """Return content without the timestamp line."""
        return self._strip_timestamp(self.content)
    
    def content_without_metadata(self) -> str:
        """Return content without timestamp and modification metadata."""
        return self._strip_modification_metadata(self._strip_timestamp(self.content))
