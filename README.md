# Baba's Money Manager

Shared expense tracker for Home, Bade Baba and Chota Baba.

Sync between phones uses an Upstash Redis database connected through Vercel Storage.
The first person to open the app creates a family PIN; the other phone enters the same PIN once.

If you ever forget the PIN: open the database in Upstash, delete the key "bmm:pin", and create a new PIN in the app. Your expenses stay safe.
