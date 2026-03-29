# Generated manually to ensure auth tables exist without running makemigrations in container.
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Todo",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("theName", models.CharField(max_length=100)),
                ("theCompleted", models.BooleanField(default=False)),
                (
                    "theOwner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="todo",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="AuditLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("username_attempt", models.CharField(blank=True, max_length=150)),
                (
                    "event",
                    models.CharField(
                        choices=[
                            ("login", "Login"),
                            ("logout", "Logout"),
                            ("token_refresh", "Token Refresh"),
                            ("login_failed", "Login Failed"),
                        ],
                        max_length=20,
                    ),
                ),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("timestamp", models.DateTimeField(auto_now_add=True)),
                ("success", models.BooleanField(default=True)),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="audit_logs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-timestamp"],
            },
        ),
    ]
