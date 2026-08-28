# Signing in as a member — how to test it

This is the "Sign in as this member" button on the Users page. It lets you see
HAEVN exactly as one of your members sees it.

Every time you use it, HAEVN writes down who you were, which member you looked
at, why, and when. That is intentional and it cannot be turned off.

## The one rule

**Generate the link in your normal HAEVN Chrome profile. Open it in a Chrome
guest profile. Never in the same window.**

If you open it in the window you generated it from, you will be signed out of
your own admin account and signed in as the member instead. Nothing breaks, but
you will have to sign back in as yourself.

## The five steps

1. **Generate.** In your normal Chrome profile, go to the Users page, find the
   member, and click **Sign in as this member**. Type a short reason (for
   example: "checking her match card") and click **Generate sign-in link**.

2. **Copy.** Click the **Copy** button next to the link that appears.

3. **Open a guest profile.** Click your Chrome profile picture in the top-right
   corner of Chrome, then click **Guest** (or **Open Guest profile**). A clean
   new Chrome window opens with nobody signed in.

4. **Paste.** Paste the link into the address bar of that guest window and press
   Enter. You will see a small HAEVN page showing which member you are about to
   sign in as. Click **Sign in as this member**.

5. **You're in.** You are now looking at HAEVN as that member. When you are
   done, just close the guest window — that signs you out and leaves no trace on
   your computer. Your own admin account in your normal window was never touched.

## Good to know

- **The link is good for 15 minutes, and it works once.** After you have used
  it, that same link will not work again. Generate a fresh one.
- **Opening the link does not use it up.** The page you land on in step 4 is
  just a confirmation page. Only pressing the button signs you in. You can open
  that page as many times as you like.
- **If something goes wrong, the page tells you which thing it is:**
  - *"This link has expired"* — more than 15 minutes passed. Generate a new one.
  - *"This link was already used"* — this link has signed someone in once
    already. Generate a new one.
  - *"This link is not valid"* — the link was probably cut off when it was
    copied. Copy it again with the Copy button.
- **Don't paste the link into Slack, email, or a text message.** Those services
  open links automatically to make a preview, and that is not what you want. Use
  the Copy button and paste straight into the guest window.
- **If the member hasn't finished their survey**, you will land on their
  onboarding screen rather than the dashboard. That is correct — it is what they
  see too.

## If it still doesn't work

Take a screenshot of whatever the page says and send it over. The message on the
page now says exactly which of the three things went wrong, so it is quick to
sort out from that alone.
