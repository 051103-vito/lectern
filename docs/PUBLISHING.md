# Publishing on GitHub (public, with automatic updates)

## One time
1. Create a **public** repository on GitHub, for example `your-name/lectern`. (It must be public so installed apps can find updates without a secret key.)
2. Replace `YOUR-GITHUB-NAME` with your GitHub user or organisation name in **two** places: `app-info.json` and `package.json` (under `build.publish`). Also change `repo` if you chose another repository name.
3. Run the app once on your own computer (`npm install`, `npm start`) and check it opens, shows the second screen, and works with a Bible verse, a song and an image.
4. Push the code:
   ```
   git init
   git add .
   git commit -m "First version"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/YOUR-REPO.git
   git push -u origin main
   ```
5. On GitHub, open **Settings, Actions, General** and make sure workflows can run, and set *Workflow permissions* to **Read and write**.

## Every release
1. Change `version` in `package.json` (for example `1.0.0`). Commit and push.
2. Tag it and push the tag:
   ```
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. The **Release** workflow builds the Windows installer and attaches it to a new GitHub Release (and a `latest.yml` file the apps use to find updates).
4. Check the **Releases** page. Write a few lines about what changed in the release notes.

## How people get updates
- New users download `Lectern-Setup-x.y.z.exe` from Releases.
- Installed copies check GitHub a few seconds after they start (this can be turned off in Settings). When a newer release exists they show a banner, **Download update**, then install it when the app is next closed. They never restart while something is on screen.
- The tag must match `package.json`, and each release needs a higher version than the last, or apps will not see it.

## The Windows "unknown publisher" warning
Unsigned installers show *Windows protected your PC*. It still works (More info, then Run anyway). To remove the warning later you need a code-signing certificate
(paid) or a free open-source signing service. Updates continue to work either way.

## If something goes wrong
- *The workflow says to fill in the placeholders*: you still have `YOUR-GITHUB-NAME` in `app-info.json` or `package.json`.
- *The workflow says the tag does not match*: change `version` in `package.json` to match the tag, commit, and tag again.
- *An update does not appear*: the release must be public (not a draft) and its version must be higher than the installed one.
