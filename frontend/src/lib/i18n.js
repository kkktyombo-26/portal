// Bilingual translations — English (en) and Swahili (sw)
export const translations = {
  en: {
    // ── Nav ──────────────────────────────────────────────────────
    dashboard:      'Dashboard',
    members:        'Members',
    groups:         'Groups',
    announcements:  'Announcements',
    settings:       'Settings',
    logout:         'Sign Out',
      tab_upload: "Upload",

    // ── Auth ─────────────────────────────────────────────────────
    login:          'Sign In',
    register:       'Register',
    email:          'Email Address',
    password:       'Password',
    full_name:      'Full Name',
    phone:          'Phone Number',
    welcome_back:   'Welcome back',
    sign_in_to:     'Sign in to your church portal',
    no_account:     "Don't have an account?",
    have_account:   'Already have an account?',

    // ── Roles ────────────────────────────────────────────────────
    pastor:         'Pastor',
    elder:          'Elder',
    group_leader:   'Group Leader',
    member:         'Member',

    // ── Dashboard overview ───────────────────────────────────────
    total_members:        'Total Members',
    active_members:       'Active Members',
    total_groups:         'Groups',
    recent_announcements: 'Recent Announcements',

    // ── Announcements ────────────────────────────────────────────
    new_announcement: 'New Announcement',
    title_english:    'Title (English)',
    title_swahili:    'Title (Swahili)',
    body_english:     'Message (English)',
    body_swahili:     'Message (Swahili)',
    broadcast_to:     'Broadcast to',
    entire_church:    'Entire Church',
    my_group:         'My Group Only',
    publish:          'Publish',
    posted_by:        'Posted by',

    // ── Members ──────────────────────────────────────────────────
    add_member:    'Add Member',
    deactivate:    'Deactivate',
    activate:      'Activate',
    delete_member: 'Remove Member',
    assign_group:  'Assign Group',
    member_since:  'Member since',

    // ── Groups ───────────────────────────────────────────────────
    new_group:     'New Group',
    group_type:    'Group Type',
    group_name_en: 'Group Name (English)',
    group_name_sw: 'Group Name (Swahili)',
    members_count: 'Members',

    // ── Common actions ───────────────────────────────────────────
    save:           'Save',
    cancel:         'Cancel',
    delete:         'Delete',
    edit:           'Edit',
    loading:        'Loading...',
    no_data:        'Nothing here yet',
    confirm_delete: 'Are you sure you want to delete this?',
    search:         'Search...',
    active:         'Active',
    inactive:       'Inactive',
    all:            'All',
    church:         'Church',
    clear:          'Clear',
    reset:          'Reset',
    view:           'View',
    open:           'Open',
    sending:        'Sending…',

    // ── Sunday Operations Dashboard ──────────────────────────────
    it_team:         'Church IT Team',
    dashboard_title: 'Sunday Operations Dashboard',

    // Tabs
    tab_channel:   'Channel Stats',
    tab_checklist: 'Sunday Checklist',
    tab_whatsapp:  'WhatsApp',

    // Status
    live_now:      'LIVE',
    offline:       'Offline',
    watching:      'watching',
    stream_status: 'Stream Status',
    open_stream:   'Open Stream',
    stats_updated: 'Stats updated',
    updated:       'Updated',

    // Channel stats
    subscribers:      'Subscribers',
    total_views:      'Total Views',
    watch_hours_12m:  'Watch Hours (12m)',
    videos_published: 'Videos Published',
    videos:           'Videos',
    target:           'Target',
    ypp_tracker:      'YPP Qualification Tracker',
    met:              'Met',
    oauth_needed:     'OAuth2 setup needed',
    oauth_run:        'Run',
    setup_needed:     'Setup needed',
    api_error:        'API error',
    quick_stats:      'Quick Stats',
    recent_uploads:   'Recent Uploads',
    no_videos_yet:    'No videos uploaded yet',
    views:            'views',
    likes:            'likes',

    // Relative time
    today:     'Today',
    yesterday: 'Yesterday',
    days_ago:  'd ago',
    weeks_ago: 'w ago',

    // Checklist
    service_readiness: 'Service Readiness',
    readiness:         'Readiness',
    tasks_done:        'tasks done',
    all_checks_done:   'All checks done — ready to go live!',
    items_remaining:   'items remaining',

    // Checklist sections
    section_pre_stream:  'Pre-Stream Setup',
    section_go_live:     'Go Live',
    section_during:      'During Service',
    section_post_stream: 'Post-Stream',

    // Checklist items — Pre-Stream
    check_gmail:       'Log into church Gmail account',
    check_obs_open:    'Open OBS Studio on streaming laptop',
    check_stream_key:  'Paste YouTube stream key into OBS',
    check_scene_check: 'Verify scenes: Camera, Screen Share, Bumper',
    check_audio_check: 'Audio levels checked (Focusrite interface)',
    check_camera1:     'Camera 1 (main) powered & framed',
    check_camera2:     'Camera 2 (wide) powered & framed',
    check_wireless:    'Wireless transmitter/receiver paired',
    check_internet:    'Internet connection confirmed (fiber/hotspot)',
    check_backup_rec:  'SD cards inserted & recording started (backup)',

    // Checklist items — Go Live
    check_yt_dashboard:  'Open YouTube Studio → Go Live',
    check_schedule_set:  'Stream title & thumbnail set',
    check_obs_start:     'OBS: Start Streaming',
    check_preview_check: 'Check YouTube preview — video & audio OK',
    check_chat_pinned:   'Pin giving details in live chat (M-Pesa/Airtel)',
    check_announce:      'Signal pastor/MC: stream is live',

    // Checklist items — During Service
    check_monitor_chat:     'Monitor live chat (assign 1 team member)',
    check_camera_switch:    'Switch cameras during sermon/worship',
    check_copyright_watch:  'Watch for copyrighted music — mute if needed',
    check_internet_monitor: 'Check internet stability every 15 min',
    check_super_thanks:     'Respond to Super Thanks in chat',

    // Checklist items — Post-Stream
    check_obs_stop:       'OBS: Stop Streaming',
    check_end_stream:     'End live stream on YouTube Studio',
    check_backup_copy:    'Copy SD card recordings to external SSD',
    check_upload_edit:    'Upload edited recording within 24 hours',
    check_title_tags:     'Add optimised title, description & tags',
    check_whatsapp_share: 'Share video link in church WhatsApp groups',
    check_analytics:      'Log views & watch time in tracking sheet',

    // ── WhatsApp tab ─────────────────────────────────────────────
    wa_stream_detected:          'Stream detected',
    wa_no_stream:                'No active stream detected',
    wa_auto_details:             'Live notification will use current stream details automatically.',
    wa_fill_manual:              'Fill in details below to send a manual notification.',
    wa_manual_details:           'Manual Notification Details',
    wa_stream_title_label:       'Stream / Video Title',
    wa_stream_title_placeholder: 'e.g. Sunday Service — 25 March 2025',
    wa_url_label:                'YouTube URL',
    wa_send_live:                'Send Live Notification',
    wa_send_test:                'Send Test Message',
    wa_preview:                  'Message Preview',
    wa_send_log:                 'Send Log',
    wa_live_notif:               'Live notification',
    wa_test_msg:                 'Test message',
    wa_sent_to:                  'Sent to',
    wa_recipients:               'recipients',
    wa_test_delivered:           'Test delivered',
    wa_default_title:            'Sunday Service',
  },

  sw: {
    // ── Nav ──────────────────────────────────────────────────────
    dashboard:      'Dashibodi',
    members:        'Wanachama',
    groups:         'Vikundi',
    announcements:  'Matangazo',
    settings:       'Mipangilio',
    logout:         'Toka',
  

// Swahili
tab_upload: "Pakia",

    // ── Auth ─────────────────────────────────────────────────────
    login:          'Ingia',
    register:       'Jisajili',
    email:          'Anwani ya Barua Pepe',
    password:       'Nywila',
    full_name:      'Jina Kamili',
    phone:          'Nambari ya Simu',
    welcome_back:   'Karibu tena',
    sign_in_to:     'Ingia kwenye mfumo wa kanisa',
    no_account:     'Huna akaunti?',
    have_account:   'Una akaunti tayari?',

    // ── Roles ────────────────────────────────────────────────────
    pastor:         'Mchungaji',
    elder:          'Mzee',
    group_leader:   'Kiongozi wa Kikundi',
    member:         'Mwanachama',

    // ── Dashboard overview ───────────────────────────────────────
    total_members:        'Jumla ya Wanachama',
    active_members:       'Wanachama Wanaofanya Kazi',
    total_groups:         'Vikundi',
    recent_announcements: 'Matangazo ya Hivi Karibuni',

    // ── Announcements ────────────────────────────────────────────
    new_announcement: 'Tangazo Jipya',
    title_english:    'Kichwa (Kiingereza)',
    title_swahili:    'Kichwa (Kiswahili)',
    body_english:     'Ujumbe (Kiingereza)',
    body_swahili:     'Ujumbe (Kiswahili)',
    broadcast_to:     'Tuma kwa',
    entire_church:    'Kanisa Lote',
    my_group:         'Kikundi Changu Tu',
    publish:          'Chapisha',
    posted_by:        'Imetumwa na',

    // ── Members ──────────────────────────────────────────────────
    add_member:    'Ongeza Mwanachama',
    deactivate:    'Lemaza',
    activate:      'Wezesha',
    delete_member: 'Ondoa Mwanachama',
    assign_group:  'Weka Kikundi',
    member_since:  'Mwanachama tangu',

    // ── Groups ───────────────────────────────────────────────────
    new_group:     'Kikundi Kipya',
    group_type:    'Aina ya Kikundi',
    group_name_en: 'Jina la Kikundi (Kiingereza)',
    group_name_sw: 'Jina la Kikundi (Kiswahili)',
    members_count: 'Wanachama',

    // ── Common actions ───────────────────────────────────────────
    save:           'Hifadhi',
    cancel:         'Ghairi',
    delete:         'Futa',
    edit:           'Hariri',
    loading:        'Inapakia...',
    no_data:        'Hakuna kitu hapa bado',
    confirm_delete: 'Una uhakika unataka kufuta hii?',
    search:         'Tafuta...',
    active:         'Hai',
    inactive:       'Si Hai',
    all:            'Yote',
    church:         'Kanisa',
    clear:          'Futa Orodha',
    reset:          'Upya',
    view:           'Angalia',
    open:           'Fungua',
    sending:        'Inatuma…',

    // ── Sunday Operations Dashboard ──────────────────────────────
    it_team:         'Timu ya IT ya Kanisa',
    dashboard_title: 'Dashibodi ya Kanisa',

    // Tabs
    tab_channel:   'Takwimu za Channel',
    tab_checklist: 'Orodha ya Jumapili',
    tab_whatsapp:  'WhatsApp',

    // Status
    live_now:      'LIVE',
    offline:       'Nje ya Mtandao',
    watching:      'wanaangalia',
    stream_status: 'Hali ya Mtiririko',
    open_stream:   'Fungua Mtiririko',
    stats_updated: 'Takwimu zimesasishwa',
    updated:       'Imesasishwa',

    // Channel stats
    subscribers:      'Wafuatao',
    total_views:      'Jumla ya Mionekano',
    watch_hours_12m:  'Masaa ya Kutazama (Miezi 12)',
    videos_published: 'Video Zilizochapishwa',
    videos:           'Video',
    target:           'Lengo',
    ypp_tracker:      'Ufuatiliaji wa Sifa za YPP',
    met:              'Imefikiwa',
    oauth_needed:     'Usanidi wa OAuth2 unahitajika',
    oauth_run:        'Endesha',
    setup_needed:     'Usanidi unahitajika',
    api_error:        'Hitilafu ya API',
    quick_stats:      'Takwimu za Haraka',
    recent_uploads:   'Mauploadi ya Hivi Karibuni',
    no_videos_yet:    'Hakuna video zilizopakiwa bado',
    views:            'mionekano',
    likes:            'kupenda',

    // Relative time
    today:     'Leo',
    yesterday: 'Jana',
    days_ago:  ' siku zilizopita',
    weeks_ago: ' wiki zilizopita',

    // Checklist
    service_readiness: 'Utayari wa Ibada',
    readiness:         'Utayari',
    tasks_done:        'kazi zimekamilika',
    all_checks_done:   'Orodha yote imekamilika — tayari kwenda moja kwa moja!',
    items_remaining:   'vipengele vilivyobaki',

    // Checklist sections
    section_pre_stream:  'Maandalizi ya Awali',
    section_go_live:     'Anza Mtiririko',
    section_during:      'Wakati wa Ibada',
    section_post_stream: 'Baada ya Mtiririko',

    // Checklist items — Pre-Stream
    check_gmail:       'Ingia kwenye akaunti ya Gmail ya kanisa',
    check_obs_open:    'Fungua OBS Studio kwenye kompyuta ya mtiririko',
    check_stream_key:  'Bandika ufunguo wa mtiririko wa YouTube kwenye OBS',
    check_scene_check: 'Thibitisha mandhari: Kamera, Shiriki Skrini, Bumper',
    check_audio_check: 'Viwango vya sauti vimekaguliwa (Kiolesura cha Focusrite)',
    check_camera1:     'Kamera 1 (kuu) imewashwa na imewekwa vizuri',
    check_camera2:     'Kamera 2 (pana) imewashwa na imewekwa vizuri',
    check_wireless:    'Mtumaji/mpokeaji bila waya wameunganishwa',
    check_internet:    'Muunganisho wa intaneti umethibitishwa (fiber/hotspot)',
    check_backup_rec:  'Kadi za SD zimewekwa na kurekodi kumeanzishwa (nakala rudufu)',

    // Checklist items — Go Live
    check_yt_dashboard:  'Fungua YouTube Studio → Enda Live',
    check_schedule_set:  'Kichwa cha mtiririko na picha ya kuvutia imewekwa',
    check_obs_start:     'OBS: Anza Kutiririka',
    check_preview_check: 'Angalia hakikisho la YouTube — video na sauti sawa',
    check_chat_pinned:   'Bana maelezo ya kutoa sadaka kwenye mazungumzo ya moja kwa moja (M-Pesa/Airtel)',
    check_announce:      'Wajulishe mchungaji/mshereheshaji: mtiririko unaendelea',

    // Checklist items — During Service
    check_monitor_chat:     'Fuatilia mazungumzo ya moja kwa moja (tenga mwanachama 1)',
    check_camera_switch:    'Badilisha kamera wakati wa mahubiri/ibada',
    check_copyright_watch:  'Angalia muziki wenye hakimiliki — zima sauti ikiwa inahitajika',
    check_internet_monitor: 'Angalia utulivu wa intaneti kila dakika 15',
    check_super_thanks:     'Jibu Super Thanks kwenye mazungumzo',

    // Checklist items — Post-Stream
    check_obs_stop:       'OBS: Simama Kutiririka',
    check_end_stream:     'Maliza mtiririko wa moja kwa moja kwenye YouTube Studio',
    check_backup_copy:    'Nakili rekodi za kadi za SD kwenye SSD ya nje',
    check_upload_edit:    'Pakia rekodi iliyohaririwa ndani ya masaa 24',
    check_title_tags:     'Ongeza kichwa kilichoboreshwa, maelezo na lebo',
    check_whatsapp_share: 'Shiriki kiungo cha video kwenye vikundi vya WhatsApp vya kanisa',
    check_analytics:      'Rekodi mionekano na muda wa kutazama kwenye laha ya ufuatiliaji',

    // ── WhatsApp tab ─────────────────────────────────────────────
    wa_stream_detected:          'Mtiririko umegunduliwa',
    wa_no_stream:                'Hakuna mtiririko unaoendelea',
    wa_auto_details:             'Arifa ya moja kwa moja itatumia maelezo ya mtiririko wa sasa kiotomatiki.',
    wa_fill_manual:              'Jaza maelezo hapa chini kutuma arifa ya mkono.',
    wa_manual_details:           'Maelezo ya Arifa ya Mkono',
    wa_stream_title_label:       'Kichwa cha Mtiririko / Video',
    wa_stream_title_placeholder: 'mfano: Ibada ya Jumapili — 25 Machi 2025',
    wa_url_label:                'Kiungo cha YouTube',
    wa_send_live:                'Tuma Arifa ya Moja kwa Moja',
    wa_send_test:                'Tuma Ujumbe wa Majaribio',
    wa_preview:                  'Hakikisho la Ujumbe',
    wa_send_log:                 'Kumbukumbu ya Kutuma',
    wa_live_notif:               'Arifa ya moja kwa moja',
    wa_test_msg:                 'Ujumbe wa majaribio',
    wa_sent_to:                  'Imetumwa kwa',
    wa_recipients:               'wapokeaji',
    wa_test_delivered:           'Majaribio yametolewa',
    wa_default_title:            'Ibada ya Jumapili',
  },
};

export const useTranslation = (lang = 'en') => {
  const t = (key) => translations[lang]?.[key] ?? translations['en']?.[key] ?? key;
  return { t };
};