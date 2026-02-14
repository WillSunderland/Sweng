from django.contrib.auth.models import User
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import Todo
from .serializers import SERIALIZE_TODO, REGISTER_USER_SERIALIZER, SERIALIZE_USER


# ------------------------------
# Registration
# ------------------------------
@api_view(['POST'])
@permission_classes([AllowAny])
def REGISTER_USER(request):
    serializer = REGISTER_USER_SERIALIZER(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ------------------------------
# Custom Login with cookies
# ------------------------------
class OBTAIN_CUSTOM_TOKEN_PAIR_VIEW(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        try:
            response = super().post(request, *args, **kwargs)
            tokens = response.data

            access_token = tokens.get('access')
            refresh_token = tokens.get('refresh')

            resp = Response({'success': True})
            resp.set_cookie(
                key='token_access',
                value=access_token,
                httponly=True,
                secure=False,  # True if using HTTPS in production
                samesite='Lax',
                path='/'
            )
            resp.set_cookie(
                key='token_refresh',
                value=refresh_token,
                httponly=True,
                secure=False,
                samesite='Lax',
                path='/'
            )
            resp.data.update(tokens)
            return resp
        except Exception as e:
            print(e)
            return Response({'success': False}, status=status.HTTP_400_BAD_REQUEST)


# ------------------------------
# Custom Refresh
# ------------------------------
class TOKEN_CUSTOM_REFRESH_VIEWS(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        try:
            refresh_token = request.COOKIES.get('token_refresh')
            if not refresh_token:
                return Response({'refreshed': False}, status=status.HTTP_401_UNAUTHORIZED)

            request.data['refresh'] = refresh_token
            response = super().post(request, *args, **kwargs)
            tokens = response.data
            access_token = tokens.get('access')

            resp = Response({'refreshed': True})
            resp.set_cookie(
                key='token_access',
                value=access_token,
                httponly=True,
                secure=False,
                samesite='Lax',
                path='/'
            )
            return resp
        except Exception as e:
            print(e)
            return Response({'refreshed': False}, status=status.HTTP_400_BAD_REQUEST)


# ------------------------------
# Logout
# ------------------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def USER_LOGOUT(request):
    resp = Response({'success': True})
    resp.delete_cookie('token_access', path='/')
    resp.delete_cookie('token_refresh', path='/')
    return resp


# ------------------------------
# Get Todos
# ------------------------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def TODOS_GET(request):
    user = request.user
    todos = Todo.objects.filter(owner=user)
    serializer = SERIALIZE_TODO(todos, many=True)
    return Response(serializer.data)


# ------------------------------
# Check if logged in
# ------------------------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def IS_USER_LOGGED_IN(request):
    serializer = SERIALIZE_USER(request.user, many=False)
    return Response(serializer.data)
