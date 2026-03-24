// Bilingual translations — English (en) and Swahili (sw)
export const translations = {
  en: {
    // Nav
    dashboard:      'Dashboard',
    members:        'Members',
    groups:         'Groups',
    announcements:  'Announcements',
    settings:       'Settings',
    logout:         'Sign Out',

    // Auth
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

    // Roles
    pastor:         'Pastor',
    elder:          'Elder',
    group_leader:   'Group Leader',
    member:         'Member',

    // Dashboard
    total_members:  'Total Members',
    active_members: 'Active Members',
    total_groups:   'Groups',
    recent_announcements: 'Recent Announcements',

    // Announcements
    new_announcement:   'New Announcement',
    title_english:      'Title (English)',
    title_swahili:      'Title (Swahili)',
    body_english:       'Message (English)',
    body_swahili:       'Message (Swahili)',
    broadcast_to:       'Broadcast to',
    entire_church:      'Entire Church',
    my_group:           'My Group Only',
    publish:            'Publish',
    posted_by:          'Posted by',

    // Members
    add_member:         'Add Member',
    deactivate:         'Deactivate',
    activate:           'Activate',
    delete_member:      'Remove Member',
    assign_group:       'Assign Group',
    member_since:       'Member since',

    // Groups
    new_group:          'New Group',
    group_type:         'Group Type',
    group_name_en:      'Group Name (English)',
    group_name_sw:      'Group Name (Swahili)',
    members_count:      'Members',

    // Common
    save:               'Save',
    cancel:             'Cancel',
    delete:             'Delete',
    edit:               'Edit',
    loading:            'Loading...',
    no_data:            'Nothing here yet',
    confirm_delete:     'Are you sure you want to delete this?',
    search:             'Search...',
    active:             'Active',
    inactive:           'Inactive',
    all:                'All',
    church:             'Church',
  },

  sw: {
    // Nav
    dashboard:      'Dashibodi',
    members:        'Wanachama',
    groups:         'Vikundi',
    announcements:  'Matangazo',
    settings:       'Mipangilio',
    logout:         'Toka',

    // Auth
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

    // Roles
    pastor:         'Mchungaji',
    elder:          'Mzee',
    group_leader:   'Kiongozi wa Kikundi',
    member:         'Mwanachama',

    // Dashboard
    total_members:  'Jumla ya Wanachama',
    active_members: 'Wanachama Wanaofanya Kazi',
    total_groups:   'Vikundi',
    recent_announcements: 'Matangazo ya Hivi Karibuni',

    // Announcements
    new_announcement:   'Tangazo Jipya',
    title_english:      'Kichwa (Kiingereza)',
    title_swahili:      'Kichwa (Kiswahili)',
    body_english:       'Ujumbe (Kiingereza)',
    body_swahili:       'Ujumbe (Kiswahili)',
    broadcast_to:       'Tuma kwa',
    entire_church:      'Kanisa Lote',
    my_group:           'Kikundi Changu Tu',
    publish:            'Chapisha',
    posted_by:          'Imetumwa na',

    // Members
    add_member:         'Ongeza Mwanachama',
    deactivate:         'Lemaza',
    activate:           'Wezesha',
    delete_member:      'Ondoa Mwanachama',
    assign_group:       'Weka Kikundi',
    member_since:       'Mwanachama tangu',

    // Groups
    new_group:          'Kikundi Kipya',
    group_type:         'Aina ya Kikundi',
    group_name_en:      'Jina la Kikundi (Kiingereza)',
    group_name_sw:      'Jina la Kikundi (Kiswahili)',
    members_count:      'Wanachama',

    // Common
    save:               'Hifadhi',
    cancel:             'Ghairi',
    delete:             'Futa',
    edit:               'Hariri',
    loading:            'Inapakia...',
    no_data:            'Hakuna kitu hapa bado',
    confirm_delete:     'Una uhakika unataka kufuta hii?',
    search:             'Tafuta...',
    active:             'Hai',
    inactive:           'Si Hai',
    all:                'Yote',
    church:             'Kanisa',
  },
};

export const useTranslation = (lang = 'en') => {
  const t = (key) => translations[lang]?.[key] || translations['en']?.[key] || key;
  return { t };
};
