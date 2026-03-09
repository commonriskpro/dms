
# UI_VISUAL_SYSTEM_V1

Version: v1
Status: Authoritative
Owner: Platform UI Architecture
Last Updated: 2026-03

---

# Overview

This document defines the **visual design system** for the Dealer App.

It establishes the **pixel‑perfect visual language** used across the application so that all modules maintain the same look and feel.

The system is designed to match the approved dashboard UI mockups and must remain visually consistent across:

• dashboard widgets  
• tables  
• queues  
• detail pages  
• forms  
• modals  

This visual system supports **Light Mode and Dark Mode**, configurable by the user.

All UI components must follow the tokens and styles defined here.

---

# 1. Layout Grid

Application layout:

Sidebar width: 260px  
Content padding: 32px  
Grid gap: 24px  
Max width: 1600px  

Dashboard grid:

grid-cols-12  
gap-24  

Widget spans:

KPI row → col-span-12  
Quick actions → col-span-7  
Deal pipeline → col-span-5  
Inventory intelligence → col-span-6  
Messaging → col-span-3  
Tasks → col-span-3  

---

# 2. Typography

Primary font:

Inter

Font sizes:

Page Title → 28px  
Section Title → 18px  
Card Title → 16px  
Body → 14px  
Small → 12px  

Font weights:

Bold → 600  
Medium → 500  
Regular → 400  

Numeric values:

tabular-nums

---

# 3. Card System

Card style:

border-radius: 14px  
padding: 20px  
border: 1px solid  
shadow: subtle  

Tailwind equivalent:

rounded-xl  
border  
shadow-sm  
p-5  

Card structure:

CardHeader  
CardBody  
CardFooter  

---

# 4. Color System

## Light Theme

Backgrounds

page: #F5F7FB  
card: #FFFFFF  
sidebar: #FFFFFF  
border: #E6EAF0  

Text

primary: #111827  
secondary: #6B7280  
muted: #9CA3AF  

Accent

#3B82F6

---

## Dark Theme

Backgrounds

page: #0F172A  
card: #1E293B  
sidebar: #0F172A  
border: #334155  

Text

primary: #F1F5F9  
secondary: #94A3B8  
muted: #64748B  

Accent

#60A5FA

---

# 5. Sidebar

Sidebar width: 260px  
Padding: 20px  
Nav item height: 40px  

Active item:

background: accent  
text: white  

Inactive item:

text-secondary  
hover: background-muted  

Icons:

20px

---

# 6. Buttons

Button height: 40px  
Border radius: 10px  
Padding: 16px  

Variants:

Primary → blue  
Secondary → gray  
Success → green  
Danger → red  

---

# 7. Table System

Row height: 48px  
Header height: 40px  

Cell padding:

px-4 py-3  

Borders:

border-b  

Hover state:

bg-muted

---

# 8. Status Chips

Chip height: 24px  
Padding: 8px  
Border radius: full  

Types:

Overpriced → red  
Aging → orange  
Underpriced → green  
Recon → blue  

---

# 9. Deal Pipeline Cards

Card height: 84px  
Padding: 12px  
Border radius: 12px  
Shadow: subtle  

Content:

Avatar  
Customer name  
Vehicle  
Deal amount  

---

# 10. Widget System

Widget structure:

Widget  
 ├ Header  
 ├ Content  
 └ Footer  

Widget padding: 24px  
Widget gap: 16px  

---

# 11. Motion

Hover transition: 120ms  

Card hover:

scale 1.01  

Button hover:

opacity 0.9 → 1  

---

# 12. Theme System

Light and Dark mode supported.

Implementation:

Tailwind dark mode  
class strategy  

User preference stored in:

localStorage

Theme toggle location:

top navigation

---

# 13. Design Tokens

Create:

apps/dealer/lib/ui/tokens.ts

Example:

export const radius = {
  card: "14px",
  button: "10px"
}

export const spacing = {
  page: "32px",
  grid: "24px"
}

export const sidebar = {
  width: "260px"
}

---

# 14. CSS Variables

Create:

apps/dealer/styles/theme.css

Variables:

--bg-page  
--bg-card  
--text-primary  
--border  
--accent  

Dark theme overrides these values.

---

# 15. Enforcement Rules

To maintain visual stability:

• No raw Tailwind color classes  
• No custom card styles  
• No custom tables  
• No custom spacing  
• Only design tokens may be used  

---

# 16. Shared UI Components

Shared components must live in:

apps/dealer/components/ui-system/

Core components:

PageShell  
Sidebar  
MetricCard  
Widget  
TableLayout  
QueueLayout  
KanbanBoard  
StatusBadge  
EntityHeader  

---

# Conclusion

This document ensures the Dealer App maintains a **consistent visual identity across all modules**.

The system guarantees:

• pixel‑perfect UI consistency  
• scalable design patterns  
• light/dark theme compatibility  
• predictable user experience  
