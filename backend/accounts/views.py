from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from .models import User, MoodCheckIn, LiteracyRecommendation, ChatMessage, Conversation, Message, EmergencyContact
from .claude_service import (
    get_chips_for_mood, get_mood_followup,
    get_mood_response, detect_topics,
    get_literacy_recommendations
)
import json
from datetime import timedelta
from django.utils import timezone
from django.db import models


def login_view(request):
    if request.user.is_authenticated:
        if request.user.is_staff:
            return redirect('dashboard')
        return redirect('home')

    if request.method == 'POST':
        email    = request.POST.get('email')
        password = request.POST.get('password')
        user     = authenticate(request, username=email, password=password)

        if user is not None:
            login(request, user)
            if user.is_staff:
                return redirect('dashboard')
            return redirect('home')
        else:
            messages.error(request, 'Invalid email or password.')
            return render(request, 'login/index.html', {
                'show_auth':  True,
                'active_tab': 'signin',
            })

    return render(request, 'login/index.html')


def signup_view(request):
    if request.user.is_authenticated:
        return redirect('home')

    if request.method == 'POST':
        first_name       = request.POST.get('first_name')
        last_name        = request.POST.get('last_name')
        email            = request.POST.get('email')
        phone_number     = request.POST.get('phone_number', '')
        gender           = request.POST.get('gender', '')
        password         = request.POST.get('password')
        confirm_password = request.POST.get('confirm_password')

        if password != confirm_password:
            messages.error(request, 'Passwords do not match.')
            return render(request, 'login/index.html', {
                'show_auth':  True,
                'active_tab': 'signup',
            })

        if User.objects.filter(email=email).exists():
            messages.error(request, 'An account with this email already exists.')
            return render(request, 'login/index.html', {
                'show_auth':  True,
                'active_tab': 'signup',
            })

        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            phone_number=phone_number,
            gender=gender,
        )
        login(request, user)
        return redirect('home')

    return redirect('login')


def logout_view(request):
    logout(request)
    return redirect('login')


def forgot_password_view(request):
    if request.method == 'POST':
        email = request.POST.get('email')
        if User.objects.filter(email=email).exists():
            messages.success(request, 'Password reset link sent to your email.')
        else:
            messages.error(request, 'No account found with that email.')
    return render(request, 'login/index.html', {
        'show_auth':  True,
        'active_tab': 'signin',
    })


@login_required(login_url='login')
def home_view(request):
    return render(request, 'enduser/home.html', {
        'user': request.user,
    })


@login_required(login_url='login')
def inbox_view(request):
    return render(request, 'enduser/inbox.html', {
        'user': request.user,
    })


@login_required(login_url='login')
def reels_view(request):
    return render(request, 'enduser/reels.html')


@login_required(login_url='login')
def support_view(request):
    return render(request, 'enduser/support.html')


@login_required(login_url='login')
def profile_view(request):
    return render(request, 'enduser/profile.html', {
        'user': request.user,
    })


@login_required(login_url='login')
def dashboard_view(request):
    if not request.user.is_staff:
        return redirect('home')
    return render(request, 'customer/admin.html')


@login_required(login_url='login')
def get_mood_chips(request):
    mood  = request.GET.get('mood', '')
    today = timezone.now().date()

    already_checked_in = MoodCheckIn.objects.filter(
        user=request.user,
        timestamp__date=today
    ).exists()

    if already_checked_in:
        return JsonResponse({
            'already_checked_in': True,
            'message': "You've already logged your mood today — but I'm still here to chat!"
        })

    chips    = get_chips_for_mood(mood)
    followup = get_mood_followup(mood, request.user.first_name)
    return JsonResponse({
        'already_checked_in': False,
        'chips':    chips,
        'followup': followup,
    })


@login_required(login_url='login')
@require_POST
def submit_checkin(request):
    today = timezone.now().date()

    if MoodCheckIn.objects.filter(user=request.user, timestamp__date=today).exists():
        return JsonResponse({'error': 'Already checked in today'}, status=400)

    data         = json.loads(request.body)
    mood         = data.get('mood', '')
    chip         = data.get('chip_selected', '')
    user_message = data.get('user_message', '')

    recent = MoodCheckIn.objects.filter(
        user=request.user,
        timestamp__gte=timezone.now() - timedelta(days=7)
    ).values('mood', 'user_message')[:3]
    history = [f"{r['mood']}: {r['user_message']}" for r in recent]

    ai_response = get_mood_response(
        mood, chip, user_message,
        request.user.first_name, history
    )

    topics = detect_topics(mood, chip, user_message)

    score_map = {'good': 5, 'calm': 4, 'stressed': 2, 'low': 2, 'sad': 1}
    MoodCheckIn.objects.create(
        user=request.user,
        mood=mood,
        mood_score=score_map.get(mood, 3),
        chip_selected=chip,
        user_message=user_message,
        ai_response=ai_response,
        topics=topics,
    )

    display_msg = f"{chip} — {user_message}" if chip and user_message else chip or user_message
    if display_msg:
        ChatMessage.objects.create(user=request.user, sender='user', message=display_msg)
    ChatMessage.objects.create(user=request.user, sender='chomi', message=ai_response)

    try:
        all_topics  = list(MoodCheckIn.objects.filter(user=request.user).values_list('topics', flat=True))
        flat_topics = list(set([
            t for sublist in all_topics
            for t in (sublist if isinstance(sublist, list) else [])
        ]))[:5]
        if not flat_topics:
            flat_topics = [mood]
        recs = get_literacy_recommendations(request.user.first_name, flat_topics)
        LiteracyRecommendation.objects.filter(user=request.user).delete()
        for rec in recs:
            if isinstance(rec, dict):
                LiteracyRecommendation.objects.create(
                    user=request.user,
                    title=rec.get('title', ''),
                    summary=rec.get('summary', ''),
                    topic=rec.get('topic', ''),
                )
    except Exception as e:
        print(f"Literacy generation error: {e}")

    return JsonResponse({'ai_response': ai_response, 'topics': topics})


@login_required(login_url='login')
def get_mood_history(request):
    today = timezone.now().date()
    days  = []
    for i in range(6, -1, -1):
        day     = today - timedelta(days=i)
        checkin = MoodCheckIn.objects.filter(
            user=request.user,
            timestamp__date=day
        ).first()
        days.append({
            'day':   day.strftime('%a'),
            'score': checkin.mood_score if checkin else 0,
            'mood':  checkin.mood if checkin else None,
        })
    return JsonResponse({'history': days})


@login_required(login_url='login')
def get_literacy(request):
    recs = LiteracyRecommendation.objects.filter(user=request.user)[:4]
    data = [{'title': r.title, 'summary': r.summary, 'topic': r.topic} for r in recs]
    return JsonResponse({'recommendations': data})


@login_required(login_url='login')
@require_POST
def continue_chat(request):
    data         = json.loads(request.body)
    user_message = data.get('user_message', '')

    recent = MoodCheckIn.objects.filter(
        user=request.user,
        timestamp__gte=timezone.now() - timedelta(days=7)
    ).values('mood', 'user_message', 'ai_response')[:3]
    history = [f"{r['mood']}: {r['user_message']}" for r in recent]

    ai_response = get_mood_response(
        'chat', '', user_message,
        request.user.first_name, history
    )

    ChatMessage.objects.create(user=request.user, sender='user',  message=user_message)
    ChatMessage.objects.create(user=request.user, sender='chomi', message=ai_response)

    return JsonResponse({'ai_response': ai_response})


@login_required(login_url='login')
def get_chat_history(request):
    today = timezone.now().date()
    msgs  = ChatMessage.objects.filter(
        user=request.user,
        timestamp__date=today
    )
    data = [{'sender': m.sender, 'message': m.message, 'time': m.timestamp.strftime('%H:%M')} for m in msgs]
    return JsonResponse({'messages': data})


@login_required(login_url='login')
def search_users(request):
    query = request.GET.get('q', '').strip()
    if len(query) < 1:
        return JsonResponse({'users': []})
    users = User.objects.filter(
        is_active=True,
        is_anonymous=False
    ).filter(
        models.Q(first_name__icontains=query) |
        models.Q(last_name__icontains=query)
    ).exclude(id=request.user.id)[:10]

    data = []
    for u in users:
        data.append({
            'id':       u.id,
            'name':     u.get_full_name(),
            'initials': (u.first_name[0] + u.last_name[0]).upper(),
            'is_anon':  False,
            'joined':   u.date_joined.strftime('%b %Y'),
            'email':    u.email,
        })
    return JsonResponse({'users': data})


@login_required(login_url='login')
def get_conversations(request):
    convos = request.user.conversations.prefetch_related('participants', 'messages').all()
    data = []
    for c in convos:
        other    = c.get_other_participant(request.user)
        last_msg = c.get_last_message()
        if not other or not last_msg:
            continue
        unread = c.messages.filter(read=False).exclude(sender=request.user).count()
        data.append({
            'id':       c.id,
            'other_id': other.id,
            'name':     'Anonymous' if other.is_anonymous else other.get_full_name(),
            'initials': 'AN' if other.is_anonymous else (other.first_name[0] + other.last_name[0]).upper(),
            'is_anon':  other.is_anonymous,
            'last_msg': last_msg.content[:60],
            'time':     last_msg.timestamp.strftime('%H:%M'),
            'unread':   unread,
        })
    return JsonResponse({'conversations': data})


@login_required(login_url='login')
def get_messages(request, conversation_id):
    from django.shortcuts import get_object_or_404
    convo = get_object_or_404(Conversation, id=conversation_id, participants=request.user)
    convo.messages.filter(read=False).exclude(sender=request.user).update(read=True)
    msgs  = convo.messages.all()
    data  = [{'sender_id': m.sender.id, 'content': m.content, 'time': m.timestamp.strftime('%H:%M'), 'is_me': m.sender == request.user} for m in msgs]
    return JsonResponse({'messages': data})


@login_required(login_url='login')
@require_POST
def send_message(request):
    from django.shortcuts import get_object_or_404
    data     = json.loads(request.body)
    other_id = data.get('other_id')
    content  = data.get('content', '').strip()
    convo_id = data.get('conversation_id')

    if not content:
        return JsonResponse({'error': 'Empty message'}, status=400)

    if convo_id:
        convo = get_object_or_404(Conversation, id=convo_id, participants=request.user)
    else:
        other    = get_object_or_404(User, id=other_id)
        existing = request.user.conversations.filter(participants=other)
        if existing.exists():
            convo = existing.first()
        else:
            convo = Conversation.objects.create()
            convo.participants.add(request.user, other)

    Message.objects.create(conversation=convo, sender=request.user, content=content)
    convo.save()
    return JsonResponse({'conversation_id': convo.id, 'status': 'sent'})


@login_required(login_url='login')
def get_user_profile(request, user_id):
    from django.shortcuts import get_object_or_404
    u        = get_object_or_404(User, id=user_id)
    checkins = MoodCheckIn.objects.filter(user=u).count()
    return JsonResponse({
        'id':       u.id,
        'name':     'Anonymous' if u.is_anonymous else u.get_full_name(),
        'initials': 'AN' if u.is_anonymous else (u.first_name[0] + u.last_name[0]).upper(),
        'is_anon':  u.is_anonymous,
        'joined':   u.date_joined.strftime('%B %Y'),
        'checkins': checkins,
        'email':    '' if u.is_anonymous else u.email,
    })


@login_required(login_url='login')
@require_POST
def inbox_chomi_chat(request):
    data         = json.loads(request.body)
    user_message = data.get('message', '')
    recent = MoodCheckIn.objects.filter(
        user=request.user,
        timestamp__gte=timezone.now() - timedelta(days=7)
    ).values('mood', 'user_message')[:3]
    history     = [f"{r['mood']}: {r['user_message']}" for r in recent]
    ai_response = get_mood_response('chat', '', user_message, request.user.first_name, history)
    ChatMessage.objects.create(user=request.user, sender='user',  message=user_message)
    ChatMessage.objects.create(user=request.user, sender='chomi', message=ai_response)
    return JsonResponse({'response': ai_response})


@login_required(login_url='login')
@require_POST
def toggle_anonymous(request):
    data         = json.loads(request.body)
    is_anonymous = data.get('is_anonymous', True)
    request.user.is_anonymous = is_anonymous
    request.user.save()
    return JsonResponse({'is_anonymous': request.user.is_anonymous})


@login_required(login_url='login')
@require_POST
def update_profile(request):
    data         = json.loads(request.body)
    first_name   = data.get('first_name', '').strip()
    last_name    = data.get('last_name', '').strip()
    email        = data.get('email', '').strip()
    phone_number = data.get('phone_number', '').strip()

    if not first_name or not last_name or not email:
        return JsonResponse({'error': 'First name, last name and email are required.'}, status=400)

    if User.objects.filter(email=email).exclude(id=request.user.id).exists():
        return JsonResponse({'error': 'That email is already in use.'}, status=400)

    request.user.first_name   = first_name
    request.user.last_name    = last_name
    request.user.email        = email
    request.user.phone_number = phone_number
    request.user.save()
    return JsonResponse({'status': 'ok'})


@login_required(login_url='login')
@require_POST
def clear_data(request):
    data        = json.loads(request.body)
    clear_mood  = data.get('clear_mood', False)
    clear_chats = data.get('clear_chats', False)
    convo_ids   = data.get('convo_ids', [])

    if clear_mood:
        MoodCheckIn.objects.filter(user=request.user).delete()
        LiteracyRecommendation.objects.filter(user=request.user).delete()
        ChatMessage.objects.filter(user=request.user).delete()

    if clear_chats and convo_ids:
        convos = Conversation.objects.filter(id__in=convo_ids, participants=request.user)
        for convo in convos:
            convo.messages.all().delete()
            convo.delete()

    return JsonResponse({'status': 'ok'})


@login_required(login_url='login')
def get_emergency_contacts(request):
    contacts = EmergencyContact.objects.filter(user=request.user)
    data     = [{'id': c.id, 'name': c.name, 'phone': c.phone} for c in contacts]
    return JsonResponse({'contacts': data})


@login_required(login_url='login')
@require_POST
def add_emergency_contact(request):
    data  = json.loads(request.body)
    name  = data.get('name', '').strip()
    phone = data.get('phone', '').strip()
    if not name or not phone:
        return JsonResponse({'error': 'Name and phone are required.'}, status=400)
    contact = EmergencyContact.objects.create(user=request.user, name=name, phone=phone)
    return JsonResponse({'status': 'ok', 'id': contact.id})


@login_required(login_url='login')
@require_POST
def delete_emergency_contact(request, contact_id):
    from django.shortcuts import get_object_or_404
    contact = get_object_or_404(EmergencyContact, id=contact_id, user=request.user)
    contact.delete()
    return JsonResponse({'status': 'ok'})

@login_required(login_url='login')
def dashboard_view(request):
    if not request.user.is_staff:
        return redirect('home')
    return render(request, 'customer/landing.html', {'user': request.user})

@login_required(login_url='login')
def admin_portal_view(request):
    if not request.user.is_staff:
        return redirect('home')
    return render(request, 'customer/index.html')

@login_required(login_url='login')
def research_dashboard_view(request):
    if not request.user.is_staff:
        return redirect('home')
    return render(request, 'customer/dashboard.html')