from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import Todo, AuditLog
from .serializers import SERIALIZE_TODO, REGISTER_USER_SERIALIZER, SERIALIZE_USER


def _get_ip(request):
    """Extract client IP from request."""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


# ------------------------------
# Registration
# ------------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def RegisterUser(request):
    serializer = REGISTER_USER_SERIALIZER(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ------------------------------
# Custom Login with cookies
# ------------------------------
class ObtainCustomTokenPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        username = request.data.get("username", "")
        try:
            response = super().post(request, *args, **kwargs)
            tokens = response.data

            access_token = tokens.get("access")
            refresh_token = tokens.get("refresh")

            # Audit log — successful login
            from django.contrib.auth.models import User

            try:
                user = User.objects.get(username=username)
                AuditLog.objects.create(
                    user=user,
                    username_attempt=username,
                    event="login",
                    ip_address=_get_ip(request),
                    success=True,
                )
            except User.DoesNotExist:
                pass

            resp = Response({"success": True})
            resp.set_cookie(
                key="token_access",
                value=access_token,
                httponly=True,
                secure=False,
                samesite="Lax",
                path="/",
            )
            resp.set_cookie(
                key="token_refresh",
                value=refresh_token,
                httponly=True,
                secure=False,
                samesite="Lax",
                path="/",
            )
            resp.data.update(tokens)
            return resp
        except Exception as e:
            # Audit log — failed login
            AuditLog.objects.create(
                user=None,
                username_attempt=username,
                event="login_failed",
                ip_address=_get_ip(request),
                success=False,
            )
            print(e)
            return Response({"success": False}, status=status.HTTP_400_BAD_REQUEST)


# ------------------------------
# Custom Refresh
# ------------------------------
class TokenCustomRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        try:
            refresh_token = request.COOKIES.get("token_refresh")
            if not refresh_token:
                return Response(
                    {"refreshed": False}, status=status.HTTP_401_UNAUTHORIZED
                )

            request.data["refresh"] = refresh_token
            response = super().post(request, *args, **kwargs)
            tokens = response.data
            access_token = tokens.get("access")

            # Audit log — token refresh
            AuditLog.objects.create(
                user=request.user if request.user.is_authenticated else None,
                event="token_refresh",
                ip_address=_get_ip(request),
                success=True,
            )

            resp = Response({"refreshed": True})
            resp.set_cookie(
                key="token_access",
                value=access_token,
                httponly=True,
                secure=False,
                samesite="Lax",
                path="/",
            )
            return resp
        except Exception as e:
            print(e)
            return Response({"refreshed": False}, status=status.HTTP_400_BAD_REQUEST)


# ------------------------------
# Logout
# ------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def UserLogout(request):
    # Audit log — logout
    AuditLog.objects.create(
        user=request.user,
        username_attempt=request.user.username,
        event="logout",
        ip_address=_get_ip(request),
        success=True,
    )
    resp = Response({"success": True})
    resp.delete_cookie("token_access", path="/")
    resp.delete_cookie("token_refresh", path="/")
    return resp


# ------------------------------
# Get Todos
# ------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def TodosGet(request):
    user = request.user
    todos = Todo.objects.filter(owner=user)
    serializer = SERIALIZE_TODO(todos, many=True)
    return Response(serializer.data)


# ------------------------------
# Check if logged in
# ------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def IsUserLoggedIn(request):
    serializer = SERIALIZE_USER(request.user, many=False)
    return Response(serializer.data)
