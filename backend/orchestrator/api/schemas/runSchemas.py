from rest_framework import serializers


class CreateRunRequestSerializer(serializers.Serializer):
    query = serializers.CharField(min_length=3, max_length=2000)
    priority = serializers.ChoiceField(
        choices=["high", "medium", "low"],
        default="medium",
        required=False,
    )


class PatchRunRequestSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=["running", "completed", "draft", "in-review"],
        required=False,
    )
    priority = serializers.ChoiceField(
        choices=["high", "medium", "low"],
        required=False,
    )

    def validate(self, data):
        if not data:
            raise serializers.ValidationError(
                "At least one of 'status' or 'priority' must be provided."
            )
        return data