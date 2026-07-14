# Gold Hunter Analytics Sprint 1

This patch upgrades GA4 event collection without changing the website design.

## Events
- content_view
- section_view
- section_engagement
- scroll_depth (25, 50, 75, 90, 100)
- content_click
- whatsapp_click
- news_interest
- details_toggle
- video_start / video_complete
- engaged_time

## Important GA4 custom definitions
Create event-scoped custom dimensions for:
- page_section
- section_id
- button_location
- button_name
- whatsapp_type
- news_type
- percent_scrolled
- first_source
- first_medium
- first_campaign
- last_source
- last_medium
- last_campaign

Dynamic economic-news cards now include stable event type/name metadata. Dynamically inserted sections are observed automatically.
