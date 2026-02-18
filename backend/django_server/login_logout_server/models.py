from django.db import models
from django.contrib.auth.models import User


class Todo(models.Model):
    theName = models.CharField(max_length=100)
    theCompleted = models.BooleanField(default=False)
    theOwner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="todo")
