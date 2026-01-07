// ============================================
// Google Calendar Integration
// Fetches and displays the next 3 upcoming events
// ============================================

const CALENDAR_EMAIL = 'wisheslittle416@gmail.com';
const CALENDAR_ID = encodeURIComponent(CALENDAR_EMAIL); // URL encode the email
// Use the correct iCal URL format
const CALENDAR_ICAL_URL = `https://calendar.google.com/calendar/ical/${CALENDAR_ID}/public/basic.ics`;
const CALENDAR_ICAL_URLS = [
    CALENDAR_ICAL_URL,
    // Try alternative formats as fallback
    `https://calendar.google.com/calendar/ical/${CALENDAR_EMAIL}/public/basic.ics`,
    `https://www.google.com/calendar/ical/${CALENDAR_ID}/public/basic.ics`
];
const CALENDAR_ICAL_URL_ALT = CALENDAR_ICAL_URLS[1];

// Parse iCal date string to JavaScript Date
function parseICalDate(dateString) {
    if (!dateString) return null;
    
    // Remove any whitespace
    dateString = dateString.trim();
    
    // iCal dates are in format: YYYYMMDDTHHMMSSZ or YYYYMMDD or YYYYMMDDTHHMMSS
    if (dateString.length === 8) {
        // Date only (all-day event) - format: YYYYMMDD
        const year = parseInt(dateString.substring(0, 4));
        const month = parseInt(dateString.substring(4, 6)) - 1; // Month is 0-indexed
        const day = parseInt(dateString.substring(6, 8));
        return new Date(year, month, day);
    } else if (dateString.includes('T')) {
        // Date and time - format: YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
        const datePart = dateString.split('T')[0];
        let timePart = dateString.split('T')[1];
        
        // Remove Z (UTC indicator) if present
        const isUTC = timePart.endsWith('Z');
        if (isUTC) {
            timePart = timePart.replace('Z', '');
        }
        
        const year = parseInt(datePart.substring(0, 4));
        const month = parseInt(datePart.substring(4, 6)) - 1;
        const day = parseInt(datePart.substring(6, 8));
        const hour = parseInt(timePart.substring(0, 2)) || 0;
        const minute = parseInt(timePart.substring(2, 4)) || 0;
        const second = parseInt(timePart.substring(4, 6)) || 0;
        
        if (isUTC) {
            return new Date(Date.UTC(year, month, day, hour, minute, second));
        } else {
            return new Date(year, month, day, hour, minute, second);
        }
    }
    
    console.warn('Unable to parse date string:', dateString);
    return null;
}

// Format date for display
function formatDate(date) {
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    };
    return date.toLocaleDateString('en-US', options);
}

// Format time for display
function formatTime(date) {
    return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
}

// Parse iCal content
function parseICal(icalContent) {
    const events = [];
    // Handle line continuations (lines starting with space or tab)
    const normalizedContent = icalContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedContent.split('\n');
    
    // Join continuation lines
    const joinedLines = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line && (line[0] === ' ' || line[0] === '\t')) {
            // Continuation line - append to previous
            if (joinedLines.length > 0) {
                joinedLines[joinedLines.length - 1] += line.substring(1);
            }
        } else {
            joinedLines.push(line);
        }
    }
    
    let currentEvent = null;
    let inEvent = false;
    
    for (let i = 0; i < joinedLines.length; i++) {
        const line = joinedLines[i].trim();
        if (!line) continue;
        
        if (line === 'BEGIN:VEVENT') {
            inEvent = true;
            currentEvent = {};
        } else if (line === 'END:VEVENT') {
            if (currentEvent && currentEvent.start && currentEvent.summary) {
                events.push(currentEvent);
            }
            inEvent = false;
            currentEvent = null;
        } else if (inEvent && currentEvent) {
            if (line.startsWith('DTSTART')) {
                // Handle DTSTART with or without parameters (e.g., DTSTART;VALUE=DATE:20250115)
                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                    const dateStr = line.substring(colonIndex + 1).trim();
                    const parsedDate = parseICalDate(dateStr);
                    if (parsedDate) {
                        currentEvent.start = parsedDate;
                    }
                }
            } else if (line.startsWith('DTEND')) {
                // Handle DTEND with or without parameters
                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                    const dateStr = line.substring(colonIndex + 1).trim();
                    const parsedDate = parseICalDate(dateStr);
                    if (parsedDate) {
                        currentEvent.end = parsedDate;
                    }
                }
            } else if (line.startsWith('SUMMARY:')) {
                currentEvent.summary = line.substring(8).trim();
            } else if (line.startsWith('DESCRIPTION:')) {
                currentEvent.description = line.substring(12).trim().replace(/\\n/g, ' ').replace(/\\,/g, ',');
            } else if (line.startsWith('LOCATION:')) {
                currentEvent.location = line.substring(9).trim().replace(/\\,/g, ',');
            }
        }
    }
    
    return events;
}

// Fetch and display calendar events
async function loadCalendarEvents() {
    const eventsContainer = document.getElementById('calendar-events');
    if (!eventsContainer) {
        console.error('Calendar events container not found');
        return;
    }
    
    try {
        // Show loading state
        eventsContainer.innerHTML = '<div style="text-align: center; padding: 2rem;"><p>Loading events...</p></div>';
        
        let icalContent;
        let success = false;
        let lastError = null;
        
        // Try direct fetch first (fastest if it works)
        try {
            const response = await fetch(CALENDAR_ICAL_URL, {
                mode: 'cors',
                cache: 'no-cache',
                headers: {
                    'Accept': 'text/calendar'
                }
            });
            if (response.ok) {
                icalContent = await response.text();
                if (icalContent && icalContent.includes('BEGIN:VCALENDAR')) {
                    success = true;
                }
            }
        } catch (directError) {
            lastError = directError;
        }
        
        // If direct fetch failed, try the fastest proxy
        if (!success) {
            try {
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(CALENDAR_ICAL_URL)}`;
                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/calendar, text/plain, */*'
                    }
                });
                
                if (response.ok) {
                    icalContent = await response.text();
                    if (icalContent && icalContent.includes('BEGIN:VCALENDAR')) {
                        success = true;
                    }
                }
            } catch (proxyError) {
                lastError = proxyError;
                
                // Try one backup proxy
                try {
                    const backupUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(CALENDAR_ICAL_URL)}`;
                    const response = await fetch(backupUrl);
                    if (response.ok) {
                        const proxyData = await response.json();
                        icalContent = proxyData.contents;
                        if (icalContent && icalContent.includes('BEGIN:VCALENDAR')) {
                            success = true;
                        }
                    }
                } catch (backupError) {
                    lastError = backupError;
                }
            }
        }
        
        if (!success || !icalContent) {
            throw new Error('Failed to fetch calendar. The calendar may not be set to public. See instructions below.');
        }
        
        if (!icalContent || !icalContent.includes('BEGIN:VCALENDAR')) {
            throw new Error('No valid calendar content received. Calendar may not be public or URL is incorrect.');
        }
        
        const events = parseICal(icalContent);
        
        // Cache the parsed events
        calendarCache.data = events;
        calendarCache.timestamp = Date.now();
        
        processEvents(events, eventsContainer);
        
    } catch (error) {
        console.error('Error loading calendar events:', error);
        eventsContainer.innerHTML = `
            <div class="event-card fade-in">
                <div class="event-date">Calendar Setup Required</div>
                <h3 class="event-title">Enable Public iCal Feed</h3>
                <p>To display events automatically, your Google Calendar needs to be set to public with iCal feed enabled.</p>
                
                <div style="text-align: left; max-width: 700px; margin: 1.5rem auto; background: #f8f9fa; padding: 1.5rem; border-radius: var(--border-radius);">
                    <h4 style="color: var(--primary-color); margin-bottom: 1rem;">How to Enable Public iCal Feed:</h4>
                    <ol style="color: var(--text-light); line-height: 1.8; padding-left: 1.5rem;">
                        <li>Go to <a href="https://calendar.google.com/calendar/settings" target="_blank" style="color: var(--primary-color);">Google Calendar Settings</a></li>
                        <li>Click on <strong>"Settings for my calendars"</strong> in the left sidebar</li>
                        <li>Select your calendar (the one with events)</li>
                        <li>Scroll down to <strong>"Access permissions"</strong> section</li>
                        <li>Check <strong>"Make available to public"</strong></li>
                        <li>Select <strong>"See all event details"</strong> from the dropdown</li>
                        <li>Scroll down to <strong>"Integrate calendar"</strong> section</li>
                        <li>Copy the <strong>"Public URL to iCal format"</strong> link</li>
                        <li>Test that link in your browser - it should show calendar data starting with <code>BEGIN:VCALENDAR</code></li>
                    </ol>
                </div>
                
                <p style="margin-top: 1.5rem; color: var(--text-light);">
                    <strong>Calendar Email:</strong> <code style="font-size: 0.85rem; background: #f0f0f0; padding: 0.2rem 0.5rem; border-radius: 4px;">${CALENDAR_EMAIL}</code>
                </p>
                
                <p style="margin-top: 1.5rem;">
                    <a href="https://calendar.google.com/calendar/u/0?cid=${encodeURIComponent(CALENDAR_EMAIL)}" target="_blank" class="btn btn-primary" style="display: inline-block;">View Calendar Directly →</a>
                </p>
                
                <p style="margin-top: 1rem; font-size: 0.85rem; color: #999;">
                    Once the calendar is public, refresh this page to see events automatically.
                </p>
            </div>
        `;
    }
}

// Process and display events
function processEvents(events, eventsContainer) {
    if (events.length === 0) {
        eventsContainer.innerHTML = `
            <div class="event-card fade-in">
                <div class="event-date">No Events Found</div>
                <h3 class="event-title">Check Back Soon!</h3>
                <p>We're planning exciting events. Stay tuned for updates!</p>
            </div>
        `;
        return;
    }
    
    // Filter for upcoming events and sort by date
    const now = new Date();
    // Set to start of today for all-day event comparison
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Filter events that haven't ended yet (compare with current time)
    const upcomingEvents = events
        .filter(event => {
            if (!event.start) {
                console.log('Event missing start date:', event);
                return false;
            }
            
            const eventStart = new Date(event.start);
            const eventEnd = event.end ? new Date(event.end) : eventStart;
            
            // For all-day events, compare dates only (not times)
            const isAllDay = eventStart.getHours() === 0 && eventStart.getMinutes() === 0 && 
                            eventStart.getSeconds() === 0 && (!event.end || 
                            (eventEnd.getHours() === 0 && eventEnd.getMinutes() === 0));
            
            if (isAllDay) {
                // For all-day events, include if end date is today or later
                const eventEndDate = new Date(eventEnd.getFullYear(), eventEnd.getMonth(), eventEnd.getDate());
                const isUpcoming = eventEndDate >= todayStart;
                return isUpcoming;
            } else {
                // For timed events, include if end time is now or later
                return eventEnd >= now;
            }
        })
        .sort((a, b) => {
            // Sort by start time, earliest first
            return a.start - b.start;
        })
        .slice(0, 3); // Limit to next 3 events only
    
    // Clear container
    eventsContainer.innerHTML = '';
    
    if (upcomingEvents.length === 0) {
        eventsContainer.innerHTML = `
            <div class="event-card fade-in">
                <div class="event-date">No Upcoming Events</div>
                <h3 class="event-title">Check Back Soon!</h3>
                <p>We're planning exciting events. Stay tuned for updates!</p>
            </div>
        `;
        return;
    }
    
    // Display the next 3 upcoming events (already limited by .slice(0, 3) above)
    upcomingEvents.forEach((event, index) => {
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card fade-in';
        eventCard.style.transitionDelay = `${index * 0.1}s`;
        
        const eventStart = new Date(event.start);
        const eventEnd = event.end ? new Date(event.end) : eventStart;
        
        // Check if it's an all-day event
        const isAllDay = eventStart.getHours() === 0 && eventStart.getMinutes() === 0 && 
                        eventStart.getSeconds() === 0 && 
                        (!event.end || (eventEnd.getHours() === 0 && eventEnd.getMinutes() === 0));
        
        let dateStr, timeStr;
        
        if (isAllDay) {
            // Format all-day events
            const options = { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric'
            };
            dateStr = eventStart.toLocaleDateString('en-US', options);
            if (event.end && eventEnd.getTime() !== eventStart.getTime()) {
                const endDateStr = eventEnd.toLocaleDateString('en-US', options);
                dateStr += ` - ${endDateStr}`;
            }
            timeStr = 'All Day';
        } else {
            // Format timed events
            dateStr = formatDate(event.start);
            timeStr = event.end ? 
                `${formatTime(event.start)} - ${formatTime(event.end)}` : 
                formatTime(event.start);
        }
        
        eventCard.innerHTML = `
            <div class="event-date">${dateStr}</div>
            <h3 class="event-title">${event.summary || 'Event'}</h3>
            ${event.description ? `<p>${event.description}</p>` : ''}
            ${event.location ? `<p style="margin-top: 1rem;"><strong>Location:</strong> ${event.location}</p>` : ''}
            <p><strong>Time:</strong> ${timeStr}</p>
        `;
        
        eventsContainer.appendChild(eventCard);
    });
    
    // Trigger fade-in animations
    setTimeout(() => {
        document.querySelectorAll('#calendar-events .fade-in').forEach((el, index) => {
            setTimeout(() => {
                el.classList.add('visible');
            }, index * 100);
        });
    }, 100);
}

// Simple cache to avoid refetching too frequently
let calendarCache = {
    data: null,
    timestamp: null,
    ttl: 5 * 60 * 1000 // 5 minutes cache
};

// Auto-refresh events every hour
function initCalendarAutoRefresh() {
    // Check cache first
    if (calendarCache.data && calendarCache.timestamp && 
        (Date.now() - calendarCache.timestamp) < calendarCache.ttl) {
        const eventsContainer = document.getElementById('calendar-events');
        if (eventsContainer) {
            processEvents(calendarCache.data, eventsContainer);
            return; // Use cache, don't fetch again
        }
    }
    
    // Load events immediately
    loadCalendarEvents();
    
    // Refresh every hour
    setInterval(() => {
        calendarCache.data = null; // Clear cache before refresh
        loadCalendarEvents();
    }, 60 * 60 * 1000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCalendarAutoRefresh);
} else {
    initCalendarAutoRefresh();
}

