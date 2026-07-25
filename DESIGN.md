# YouTube Clone Design System

Design a modern video-sharing app inspired by YouTube, but with original branding and visuals.

## Style

- Clean, minimal, content-first
- Dark and light mode
- Rounded thumbnails and controls
- Strong emphasis on video content
- Fast, familiar navigation

## Colors

```css
--brand: #ff3b30;
--background: #ffffff;
--surface: #f5f5f5;
--text: #111111;
--muted: #666666;
--border: #e5e5e5;
```

Dark mode:

```css
--background: #0f0f0f;
--surface: #202020;
--text: #ffffff;
--muted: #aaaaaa;
--border: #333333;
```

## Typography

Use Inter or Roboto.

- Page title: 24px, bold
- Video title: 16px, semibold
- Body: 14px
- Metadata: 12px, muted

## Layout

Desktop:

- Sticky top navigation
- Collapsible left sidebar
- Responsive video grid
- Watch page with video and recommendations

Mobile:

- Compact top bar
- Bottom navigation
- One video per row
- Full-screen Shorts feed

## Core Components

- Header
- Sidebar
- Search bar
- Video card
- Thumbnail
- Channel avatar
- Subscribe button
- Category chips
- Video player
- Comments
- Playlist
- Modal
- Dropdown menu
- Toast
- Skeleton loader

## Video Card

Each card includes:

- 16:9 thumbnail
- Duration badge
- Video title
- Channel name
- Views and upload date
- More-actions button

Limit titles to two lines.

## Main Pages

- Home
- Search
- Watch
- Shorts
- Subscriptions
- Channel
- Library
- History
- Upload
- Creator dashboard

## Rules

- Use 8–12px rounded corners
- Use 4px-based spacing
- Keep clickable targets at least 40px
- Use Lucide icons
- Show clear hover, active, loading, and disabled states
- Keep the interface responsive and accessible
- Do not copy YouTube branding or exact layouts
