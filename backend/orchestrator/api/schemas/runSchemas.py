from rest_framework import serializers


class CreateRunRequestSerializer(serializers.Serializer):
    query = serializers.CharField(min_length=3, max_length=2000)
