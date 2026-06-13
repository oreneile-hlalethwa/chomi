import os
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django_ratelimit.decorators import ratelimit
from .models import User, MoodCheckIn, LiteracyRecommendation, ChatMessage, Conversation, Message, EmergencyContact
from .claude_service import (
    get_chips_for_mood, get_mood_followup,
    get_mood_response, detect_topics,
    get_literacy_recommendations
)
import json
from datetime import timedelta, datetime
from django.utils import timezone
from django.db import models


# ── RATE LIMIT HELPER ──
def rate_limited_response(request, group=None, key=None):
    return JsonResponse({'error': 'Too many requests. Please slow down.'}, status=429)


@ratelimit(key='ip', rate='5/m', method='POST', block=True)
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


@ratelimit(key='ip', rate='3/m', method='POST', block=True)
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
    return render(request, 'enduser/home.html', {'user': request.user})


@login_required(login_url='login')
def inbox_view(request):
    return render(request, 'enduser/inbox.html', {'user': request.user})


@login_required(login_url='login')
def reels_view(request):
    return render(request, 'enduser/reels.html')


@login_required(login_url='login')
def support_view(request):
    return render(request, 'enduser/support.html')


@login_required(login_url='login')
def profile_view(request):
    return render(request, 'enduser/profile.html', {'user': request.user})


@login_required(login_url='login')
def dashboard_view(request):
    if not request.user.is_staff:
        return redirect('home')
    return render(request, 'customer/landing.html', {'user': request.user})


@login_required(login_url='login')
def admin_portal_view(request):
    if not request.user.is_staff:
        return redirect('home')
    return render(request, 'customer/index.html', {'user': request.user})


@login_required(login_url='login')
def research_dashboard_view(request):
    if not request.user.is_staff:
        return redirect('home')
    return render(request, 'customer/dashboard.html', {'user': request.user})


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
@ratelimit(key='user', rate='10/m', block=True)
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

    ai_response = get_mood_response(mood, chip, user_message, request.user.first_name, history)
    topics      = detect_topics(mood, chip, user_message)

    score_map = {'good': 5, 'calm': 4, 'stressed': 2, 'low': 2, 'sad': 1}
    MoodCheckIn.objects.create(
        user=request.user, mood=mood,
        mood_score=score_map.get(mood, 3),
        chip_selected=chip, user_message=user_message,
        ai_response=ai_response, topics=topics,
    )

    display_msg = f"{chip} — {user_message}" if chip and user_message else chip or user_message
    if display_msg:
        ChatMessage.objects.create(user=request.user, sender='user', message=display_msg)
    ChatMessage.objects.create(user=request.user, sender='chomi', message=ai_response)

    try:
        all_topics  = list(MoodCheckIn.objects.filter(user=request.user).values_list('topics', flat=True))
        flat_topics = list(set([t for sublist in all_topics for t in (sublist if isinstance(sublist, list) else [])]))[:5]
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
        checkin = MoodCheckIn.objects.filter(user=request.user, timestamp__date=day).first()
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
@ratelimit(key='user', rate='20/m', block=True)
def continue_chat(request):
    data         = json.loads(request.body)
    user_message = data.get('user_message', '')

    recent = MoodCheckIn.objects.filter(
        user=request.user,
        timestamp__gte=timezone.now() - timedelta(days=7)
    ).values('mood', 'user_message', 'ai_response')[:3]
    history     = [f"{r['mood']}: {r['user_message']}" for r in recent]
    ai_response = get_mood_response('chat', '', user_message, request.user.first_name, history)

    ChatMessage.objects.create(user=request.user, sender='user',  message=user_message)
    ChatMessage.objects.create(user=request.user, sender='chomi', message=ai_response)
    return JsonResponse({'ai_response': ai_response})


@login_required(login_url='login')
def get_chat_history(request):
    today = timezone.now().date()
    msgs  = ChatMessage.objects.filter(user=request.user, timestamp__date=today)
    data  = [{'sender': m.sender, 'message': m.message, 'time': m.timestamp.strftime('%H:%M')} for m in msgs]
    return JsonResponse({'messages': data})


@login_required(login_url='login')
@ratelimit(key='user', rate='30/m', block=True)
def search_users(request):
    query = request.GET.get('q', '').strip()
    if len(query) < 1:
        return JsonResponse({'users': []})
    users = User.objects.filter(
        is_active=True, is_anonymous=False
    ).filter(
        models.Q(first_name__icontains=query) | models.Q(last_name__icontains=query)
    ).exclude(id=request.user.id)[:10]

    data = []
    for u in users:
        data.append({
            'id':          u.id,
            'name':        u.get_full_name(),
            'initials':    (u.first_name[0] + u.last_name[0]).upper(),
            'is_anon':     False,
            'is_verified': u.is_verified,
            'joined':      u.date_joined.strftime('%b %Y'),
            'email':       u.email,
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
            'id':          c.id,
            'other_id':    other.id,
            'name':        'Anonymous' if other.is_anonymous else other.get_full_name(),
            'initials':    'AN' if other.is_anonymous else (other.first_name[0] + other.last_name[0]).upper(),
            'is_anon':     other.is_anonymous,
            'is_verified': other.is_verified,
            'last_msg':    last_msg.content[:60],
            'time':        last_msg.timestamp.strftime('%H:%M'),
            'unread':      unread,
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
@ratelimit(key='user', rate='20/m', block=True)
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
        'id':          u.id,
        'name':        'Anonymous' if u.is_anonymous else u.get_full_name(),
        'initials':    'AN' if u.is_anonymous else (u.first_name[0] + u.last_name[0]).upper(),
        'is_anon':     u.is_anonymous,
        'is_verified': u.is_verified,
        'joined':      u.date_joined.strftime('%B %Y'),
        'checkins':    checkins,
        'email':       '' if u.is_anonymous else u.email,
    })


@login_required(login_url='login')
@require_POST
@ratelimit(key='user', rate='20/m', block=True)
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


# ══════════════════════════════
# ADMIN VIEWS
# ══════════════════════════════

@login_required(login_url='login')
def admin_stats(request):
    if not request.user.is_staff:
        return JsonResponse({'error': 'Forbidden'}, status=403)

    today = timezone.now().date()
    non_staff = User.objects.filter(is_staff=False)

    total_accounts = non_staff.count()
    active_users   = non_staff.filter(is_active=True).count()
    total_checkins = MoodCheckIn.objects.count()

    mood_dist = {}
    for mood, _ in MoodCheckIn.MOOD_CHOICES:
        mood_dist[mood] = MoodCheckIn.objects.filter(mood=mood).count()

    signups = []
    for i in range(29, -1, -1):
        day   = today - timedelta(days=i)
        count = non_staff.filter(date_joined__date=day).count()
        signups.append({'label': day.strftime('%d %b'), 'count': count})

    day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    active_by_day = [0] * 7
    checkins_90 = MoodCheckIn.objects.filter(timestamp__gte=timezone.now() - timedelta(days=90))
    for c in checkins_90:
        active_by_day[c.timestamp.weekday()] += 1
    active_by_day_data = [{'day': day_names[i], 'count': active_by_day[i]} for i in range(7)]

    screen_time = []
    for i in range(6, -1, -1):
        day   = today - timedelta(days=i)
        count = ChatMessage.objects.filter(timestamp__date=day, sender='user').count()
        screen_time.append({'day': day.strftime('%a'), 'mins': count * 2})

    new_vs_returning = []
    for i in range(5, -1, -1):
        month_start = (today.replace(day=1) - timedelta(days=i*30)).replace(day=1)
        month_end   = (month_start + timedelta(days=32)).replace(day=1)
        new_users   = non_staff.filter(date_joined__date__gte=month_start, date_joined__date__lt=month_end).count()
        returning   = MoodCheckIn.objects.filter(
            timestamp__date__gte=month_start, timestamp__date__lt=month_end
        ).values('user').distinct().exclude(user__date_joined__date__gte=month_start).count()
        new_vs_returning.append({'label': month_start.strftime('%b'), 'new': new_users, 'returning': returning})

    retention = []
    for i in range(11, -1, -1):
        week_start = today - timedelta(days=today.weekday() + i*7)
        week_end   = week_start + timedelta(days=7)
        users_that_week = MoodCheckIn.objects.filter(timestamp__date__gte=week_start, timestamp__date__lt=week_end).values('user').distinct().count()
        returned_next   = MoodCheckIn.objects.filter(timestamp__date__gte=week_end, timestamp__date__lt=week_end + timedelta(days=7)).values('user').distinct().count()
        rate = round((returned_next / users_that_week * 100) if users_that_week else 0)
        retention.append({'label': week_start.strftime('%d %b'), 'rate': rate})

    streak_buckets = {'1 day': 0, '2-3': 0, '4-7': 0, '8-14': 0, '15-30': 0, '30+': 0}
    for u in non_staff:
        streak = 0
        for j in range(30):
            day = today - timedelta(days=j)
            if MoodCheckIn.objects.filter(user=u, timestamp__date=day).exists():
                streak += 1
            else:
                break
        if streak == 1:    streak_buckets['1 day'] += 1
        elif streak <= 3:  streak_buckets['2-3']   += 1
        elif streak <= 7:  streak_buckets['4-7']   += 1
        elif streak <= 14: streak_buckets['8-14']  += 1
        elif streak <= 30: streak_buckets['15-30'] += 1
        elif streak > 30:  streak_buckets['30+']   += 1

    total_with_streak = sum(streak_buckets.values()) or 1
    streak_dist = [{'label': k, 'pct': round(v / total_with_streak * 100)} for k, v in streak_buckets.items()]

    support_visits = ChatMessage.objects.filter(message__icontains='support').values('user').distinct().count()

    week_ago        = today - timedelta(days=7)
    users_last_week = MoodCheckIn.objects.filter(timestamp__date__gte=week_ago).values('user').distinct().count()
    users_two_weeks = MoodCheckIn.objects.filter(timestamp__date__gte=today - timedelta(days=14), timestamp__date__lt=week_ago).values('user').distinct().count()
    retention_rate  = str(round((users_last_week / users_two_weeks * 100) if users_two_weeks else 0)) + '%'

    gender_labels = {'female': 'Female', 'male': 'Male', 'non_binary': 'Non-binary', 'prefer_not': 'Prefer not to say', '': 'Not specified'}
    gender_counts = {}
    for code, label in gender_labels.items():
        count = non_staff.filter(gender=code).count()
        if count > 0:
            gender_counts[label] = count

    anon_count   = non_staff.filter(is_anonymous=True).count()
    public_count = non_staff.filter(is_anonymous=False).count()

    return JsonResponse({
        'total_accounts':      total_accounts,
        'active_users':        active_users,
        'total_checkins':      total_checkins,
        'support_visits':      support_visits,
        'retention_rate':      retention_rate,
        'mood_distribution':   mood_dist,
        'signups_over_time':   signups,
        'active_by_day':       active_by_day_data,
        'screen_time':         screen_time,
        'new_vs_returning':    new_vs_returning,
        'retention':           retention,
        'streak_dist':         streak_dist,
        'gender_distribution': gender_counts,
        'anon_count':          anon_count,
        'public_count':        public_count,
    })


@login_required(login_url='login')
def admin_users(request):
    if not request.user.is_staff:
        return JsonResponse({'error': 'Forbidden'}, status=403)

    users = User.objects.filter(is_staff=False).order_by('-date_joined')
    data  = []

    for u in users:
        checkins     = MoodCheckIn.objects.filter(user=u).count()
        last_checkin = MoodCheckIn.objects.filter(user=u).first()

        streak = 0
        today  = timezone.now().date()
        for i in range(30):
            day = today - timedelta(days=i)
            if MoodCheckIn.objects.filter(user=u, timestamp__date=day).exists():
                streak += 1
            else:
                break

        if last_checkin:
            delta = (today - last_checkin.timestamp.date()).days
            if delta == 0:   last_active = 'Today'
            elif delta == 1: last_active = 'Yesterday'
            else:            last_active = f'{delta} days ago'
        else:
            last_active = 'Never'

        initials = (u.first_name[0] + u.last_name[0]).upper() if u.first_name and u.last_name else '??'

        data.append({
            'id':           u.id,
            'first_name':   u.first_name,
            'last_name':    u.last_name,
            'email':        u.email,
            'initials':     initials,
            'is_active':    u.is_active,
            'is_anonymous': u.is_anonymous,
            'is_verified':  u.is_verified,
            'date_joined':  u.date_joined.strftime('%b %Y'),
            'checkins':     checkins,
            'streak':       streak,
            'last_active':  last_active,
        })

    return JsonResponse({'users': data})


@login_required(login_url='login')
@require_POST
def admin_verify_user(request, user_id):
    if not request.user.is_staff:
        return JsonResponse({'error': 'Forbidden'}, status=403)

    from django.shortcuts import get_object_or_404
    u = get_object_or_404(User, id=user_id)
    u.is_verified = not u.is_verified
    u.save()
    return JsonResponse({'is_verified': u.is_verified})