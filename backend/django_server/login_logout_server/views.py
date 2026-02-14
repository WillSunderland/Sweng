from django.contrib.auth.models import User
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny

from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from streamlit import status

from .models import Todo
from .serializers import SERIALIZE_TODO, REGISTER_USER_SERIALIZER, SERIALIZE_USER

from datetime import datetime, timedelta

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def REGISTER_USER(request):
    serializer = REGISTER_USER_SERIALIZER(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class OBTAIN_CUSTOM_TOKEN_PAIR_VIEW(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        try:
            response = super().post(request, *args, **kwargs)
            token = response.data

            token_access = token['access']
            token_refresh = token['refresh']

            serializer = SERIALIZE_USER(request.user, many=False)

            resp = Response()

            resp.data = {'success':True}

            resp.set_cookie(
                key='token_access',
                value=str(token_access),
                httponly=True,
                secure=True,
                samesite='None',
                path='/'
            )
            resp.set_cookie(
                key='token_refresh',
                value=str(token_refresh),
                httponly=True,
                secure=True,
                samesite='None',
                path='/'
            )
            resp.data.update(token)
            return resp
        except Exception as e:
            print(e)
            return Response({'success':False})

class TOKEN_CUSTOM_REFRESH_VIEWS(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        try:
            token_refresh = request.COOKIES.get('token_refresh')

            request.data['refresh'] = token_refresh

            response = super().post(request, *args, **kwargs)
            token = response.data
            token_access = token['access']

            resp = Response()
            resp.data = {'refreshed':True}

            resp.set_cookie(
                key='token_access',
                value=token_access,
                httponly=True,
                secure=False,
                samesite='None',
                path='/'
            )
            return resp

        except Exception as e:
            print(e)
            return Response({'refreshed':False})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def USER_LOGOUT(request):
    try:
        RESPONSE = Response()
        RESPONSE.data = {'success':True}
        return RESPONSE
    except Exception as e:
        print(e)
        return Response({'success':False})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def TODOS_GET(request):
    user = request.user
    TODOS = Todo.objects.filter(owner=user)
    serializer = SERIALIZE_TODO(TODOS, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def IS_USER_LOGGED_IN(request):
    serializer = SERIALIZE_USER(request.user, many=False)
    return Response(serializer.data)

