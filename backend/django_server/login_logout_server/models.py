from django.db import models
from django.contrib.auth.models import User


class Todo(models.Model):
    theName = models.CharField(max_length=100)
    theCompleted = models.BooleanField(default=False)
    theOwner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="todo")


class AuditLog(models.Model):
    EVENT_CHOICES = [
        ("login", "Login"),
        ("logout", "Logout"),
        ("token_refresh", "Token Refresh"),
        ("login_failed", "Login Failed"),
    ]

    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs"
    )
    username_attempt = models.CharField(max_length=150, blank=True)
    event = models.CharField(max_length=20, choices=EVENT_CHOICES)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    success = models.BooleanField(default=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.timestamp} | {self.event} | {self.username_attempt or self.user} | success={self.success}"