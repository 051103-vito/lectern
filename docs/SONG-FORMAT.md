# Importing songs from .txt files

Use **Songs, Import .txt files** (or **Import a folder**). The program reads each file and works out the song by itself.
You always get a review window before anything is saved.

## What it understands
- **Title and author.** `Title: Amazing Grace` / `Author: John Newton`, or a short title line followed by an author line at the top.
- **Section labels.** `Verse 1`, `[Chorus]`, `Bridge`, `Pre-Chorus`, `Tag`, `Intro`, `Outro`, `Chorus x2`.
- **Numbered stanzas.** Stanzas starting `1.` `2.` `3.` become Verse 1, 2, 3.
- **A repeated stanza** with no label is treated as the chorus, and the singing order is built from it.
- **A chorus written once** between verses is repeated after every verse (you can switch this off in the review window).
- **Chord lines** (`G  D  Em  C`) and inline chords (`[G]`) are removed.
- **Copyright lines** (`Public Domain`, `(c) ...`, `CCLI ...`) are kept as information and not shown on the slides.
- **Several songs in one file** when they are divided by a line of `====` or `----`, or start with `Title:`.
- Files saved by older Windows programs, with accents and curly quotes, are read correctly.

## After importing
Open **Edit** to correct anything. The editor shows the song as plain text with `[Verse 1]` style labels and an `Order:` line,
and a preview of the slides. Lines per slide can be set for each song (default 4).
