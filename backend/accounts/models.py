from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    GENDER_CHOICES = [
        ('female', 'Female'),
        ('male', 'Male'),
        ('non_binary', 'Non-binary'),
        ('prefer_not', 'Prefer not to say'),
    ]

    email        = models.EmailField(unique=True)
    first_name   = models.CharField(max_length=100)
    last_name    = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=20, blank=True)
    gender       = models.CharField(max_length=20, choices=GENDER_CHOICES, blank=True)
    is_anonymous = models.BooleanField(default=True)
    is_active    = models.BooleanField(default=True)
    is_staff     = models.BooleanField(default=False)
    is_verified  = models.BooleanField(default=False)
    date_joined  = models.DateTimeField(auto_now_add=True)
    last_login   = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    objects = UserManager()

    def __str__(self):
        return self.email

    def get_full_name(self):
        return f'{self.first_name} {self.last_name}'


class MoodCheckIn(models.Model):
    MOOD_CHOICES = [
        ('calm', 'Calm'),
        ('low', 'Low'),
        ('stressed', 'Stressed'),
        ('good', 'Good'),
        ('sad', 'Sad'),
    ]
    MOOD_SCORES = {
        'calm': 4,
        'good': 5,
        'stressed': 2,
        'low': 2,
        'sad': 1,
    }

    user           = models.ForeignKey(User, on_delete=models.CASCADE, related_name='checkins')
    mood           = models.CharField(max_length=20, choices=MOOD_CHOICES)
    mood_score     = models.IntegerField(default=3)
    chip_selected  = models.CharField(max_length=100, blank=True)
    user_message   = models.TextField(blank=True)
    ai_response    = models.TextField(blank=True)
    topics         = models.JSONField(default=list)
    timestamp      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f'{self.user.email} — {self.mood} — {self.timestamp}'


class LiteracyRecommendation(models.Model):
    user         = models.ForeignKey(User, on_delete=models.CASCADE, related_name='literacy')
    title        = models.CharField(max_length=200)
    summary      = models.TextField()
    topic        = models.CharField(max_length=100)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-generated_at']

    def __str__(self):
        return f'{self.user.email} — {self.title}'


class ChatMessage(models.Model):
    SENDER_CHOICES = [
        ('user',  'User'),
        ('chomi', 'Chomi'),
    ]
    user      = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_messages')
    sender    = models.CharField(max_length=10, choices=SENDER_CHOICES)
    message   = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f'{self.user.email} — {self.sender} — {self.timestamp}'


class Conversation(models.Model):
    participants = models.ManyToManyField(User, related_name='conversations')
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f'Conversation {self.id}'

    def get_last_message(self):
        return self.messages.last()

    def get_other_participant(self, user):
        return self.participants.exclude(id=user.id).first()


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    content      = models.TextField()
    read         = models.BooleanField(default=False)
    timestamp    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f'{self.sender.email}: {self.content[:50]}'


class EmergencyContact(models.Model):
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='emergency_contacts')
    name       = models.CharField(max_length=100)
    phone      = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

class JournalEntry(models.Model):
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='journal_entries')
    content    = models.TextField()
    mood       = models.CharField(max_length=20, blank=True)
    prompt     = models.TextField(blank=True)
    word_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.email} — journal — {self.created_at.date()}'