#!/bin/sh

echo 'Compressing Large Files...'

npx gzipper --brotli html/
npx gzipper html/
npx gzipper --brotli data/
npx gzipper data/
npx gzipper --brotli js/
npx gzipper js/
npx gzipper --brotli css/
npx gzipper css/
npx gzipper --brotli vendor/
npx gzipper vendor/
npx gzipper --brotli workers/
npx gzipper workers/
