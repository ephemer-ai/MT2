var CACHE = 'MT2d2021-03-25R';

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll([
        '/',
        'index.html',
        'package.json',
        'manifest.json',
        'favicon.ico',
        'humans.txt',
        'LICENSE',
      ]);
    })
  );
});

self.addEventListener('fetch', function(evt){
  evt.respondWith(fetch(evt.request).catch(function(){
    return caches.open(CACHE).then(function(cache){
      return cache.match(evt.request).then(function(matching){
        return matching || Promise.reject('No Match for ', evt.request, 'in Service Worker Cache!');
      });
    });
  }));
});

