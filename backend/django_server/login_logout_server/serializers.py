from .models import Todo

from rest_framework import serializers
from django.contrib.auth.models import User


class SERIALIZE_TODO(serializers.ModelSerializer):
    class Meta:
        model = Todo
        fields = ["id", "name", "completed"]


class REGISTER_USER_SERIALIZER(serializers.ModelSerializer):
    email = serializers.EmailField(required=False, allow_blank=True, default="")

    class Meta:
        model = User
        fields = ["username", "email", "password"]

    def create(self, validated_data):
        user = User(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
        )
        user.set_password(validated_data["password"])
        user.save()
        return user


class SERIALIZE_USER(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["username"]
