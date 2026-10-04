KURDIA ADVENTURE — ADMIN DOMAIN ROUTING FIX

Purpose:
  kurdiaadventure.com/           -> index.html (main website)
  admin.kurdiaadventure.com/    -> admin.html (admin dashboard)

Files:
  index.html
  admin.html
  vercel.json

IMPORTANT:
  Upload/commit these files to the SAME Vercel project that currently serves
  kurdia-adventure.vercel.app.

Cloudflare DNS for Admin:
  Type: CNAME
  Name: admin
  Target: the Vercel target shown for admin.kurdiaadventure.com
  Proxy: DNS only

No Worker/KV/DNS main-site logic is changed by this package.
