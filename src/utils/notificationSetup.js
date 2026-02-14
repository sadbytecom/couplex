// src/utils/notificationSetup.js

// Inicializuj Service Worker a push notifikace
export const initPushNotifications = async () => {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    console.warn('Push notifikace nejsou v tomto prohlížeči podporovány');
    return false;
  }

  try {
    // Zaregistruj Service Worker
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });
    console.log('Service Worker zaregistrován:', registration);

    // Požádej o permisi
    if (Notification.permission === 'granted') {
      return true;
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  } catch (error) {
    console.error('Chyba při registraci Service Workera:', error);
    return false;
  }
};

// Pošli lokální notifikaci (pro okamžitou zpětnou vazbu)
export const sendLocalNotification = (title, options = {}) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        options
      });
    }
  }
};

// Nastav real-time listener pro nové emoce (Supabase)
export const setupEmotionListener = (supabaseClient, partnershipId, currentUserId, callback) => {
  if (!partnershipId) return null;

  const channel = supabaseClient
    .channel(`partnership_${partnershipId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'emotions',
        filter: `partnership_id=eq.${partnershipId}`
      },
      (payload) => {
        // Pokud je to zpráva od partnera (ne od tebe)
        if (payload.new.shared_by_id !== currentUserId) {
          const emotionType = payload.new.emotion_type;
          
          // Pošli notifikaci
          sendLocalNotification('Couplex', {
            body: `Partner sdílí svou emoci: ${emotionType}`,
            icon: '/heart-icon.png',
            badge: '/badge-icon.png',
            tag: 'couplex-emotion',
            vibrate: [200, 100, 200],
            requireInteraction: false
          });

          // Zavolej callback (refresh dat)
          if (callback) callback();
        }
      }
    )
    .subscribe();

  return channel;
};