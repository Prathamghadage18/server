from django import forms


class NoteForm(forms.Form):
    content = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            "rows": 30,
            "class": "form-control",
            "placeholder": "Write your note here (max 10000 lines). A timestamp will be appended automatically on save.",
        }),
        help_text="Up to 10000 lines of text. A timestamp line will be added automatically when saved.",
        label="Note",
    )

    MAX_LINES = 10000

    def clean_content(self):
        value = self.cleaned_data.get("content", "")
        # Normalize line endings and enforce line limit (excluding timestamp which we add later)
        lines = value.replace("\r\n", "\n").replace("\r", "\n").split("\n")
        # Ignore trailing empty line in counting
        while lines and lines[-1] == "":
            lines.pop()
        if len(lines) > self.MAX_LINES:
            raise forms.ValidationError(f"Note cannot exceed {self.MAX_LINES} lines (currently {len(lines)} lines)")
        return value
