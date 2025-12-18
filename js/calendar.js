// ============================================
// Google Calendar Integration
// Fetches and displays the next 3 upcoming events
// ============================================

const CALENDAR_ID = 'd2lzaGVzbGl0dGxlNDE2QGdtYWlsLmNvbQ';
const CALENDAR_ICAL_URL = `https://calendar.google.com/calendar/ical/${CALENDAR_ID}/public/basic.ics`;

// Parse iCal date string to JavaScript Date
function parseICalDate(dateString) {
    // iCal dates are in format: YYYYMMDDTHHMMSSZ or YYYYMMDD
    if (dateString.length === 8) {
        // Date only (all-day event)
        const year = dateString.substring(0, 4);
        const month = dateString.substring(4, 6);
        const day = dateString.substring(6, 8);
        return new Date(year, parseInt(month) - 1, day);
    } else if (dateString.includes('T')) {
        // Date and time
        const datePart = dateString.split('T')[0];
        const timePart = dateString.split('T')[1].replace('Z', '');
        const year = datePart.substring(0, 4);
        const month = datePart.substring(4, 6);
        const day = datePart.substring(6, 8);
        const hour = timePart.substring(0, 2);
        const minute = timePart.substring(2, 4);
        const second = timePart.substring(4, 6) || '00';
        return new Date(Date.UTC(year, parseInt(month) - 1, day, hour, minute, second));
    }
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
                const parts = line.split(':');
                if (parts.length > 1) {
                    const dateStr = parts.slice(1).join(':');
                    currentEvent.start = parseICalDate(dateStr);
                }
            } else if (line.startsWith('DTEND')) {
                const parts = line.split(':');
                if (parts.length > 1) {
                    const dateStr = parts.slice(1).join(':');
                    currentEvent.end = parseICalDate(dateStr);
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
    if (!eventsContainer) return;
    
    try {
        // Show loading state
        eventsContainer.innerHTML = '<div style="text-align: center; padding: 2rem;"><p>Loading events...</p></div>';
        
        // Fetch iCal feed with CORS proxy if needed
        let response;
        try {
            response = await fetch(CALENDAR_ICAL_URL, {
                mode: 'cors',
                cache: 'no-cache'
            });
        } catch (corsError) {
            // If CORS fails, try using a proxy
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(CALENDAR_ICAL_URL)}`;
            response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error('Failed to fetch calendar');
            }
            const proxyData = await response.json();
            const icalContent = proxyData.contents;
            const events = parseICal(icalContent);
            processEvents(events, eventsContainer);
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to fetch calendar');
        }
        
        const icalContent = await response.text();
        const events = parseICal(icalContent);
        processEvents(events, eventsContainer);
        
    } catch (error) {
        console.error('Error loading calendar events:', error);
        eventsContainer.innerHTML = `
            <div class="event-card fade-in">
                <div class="event-date">Unable to Load Events</div>
                <h3 class="event-title">Calendar Unavailable</h3>
                <p>We're having trouble loading events. Please check back later or <a href="https://calendar.google.com/calendar/u/0?cid=${CALENDAR_ID}" target="_blank" style="color: var(--primary-color);">view our calendar directly</a>.</p>
            </div>
        `;
    }
}

// Process and display events
function processEvents(events, eventsContainer) {
    // Filter for upcoming events and sort by date
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Reset to start of day for comparison
    
    const upcomingEvents = events
        .filter(event => {
            if (!event.start) return false;
            const eventDate = new Date(event.start);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate >= now;
        })
        .sort((a, b) => a.start - b.start)
        .slice(0, 3); // Get next 3 events
    
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
    
    // Display events
    upcomingEvents.forEach((event, index) => {
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card fade-in';
        eventCard.style.transitionDelay = `${index * 0.1}s`;
        
        const dateStr = formatDate(event.start);
        const timeStr = event.end ? 
            `${formatTime(event.start)} - ${formatTime(event.end)}` : 
            formatTime(event.start);
        
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

// Auto-refresh events every hour
function initCalendarAutoRefresh() {
    // Load events immediately
    loadCalendarEvents();
    
    // Refresh every hour
    setInterval(() => {
        loadCalendarEvents();
    }, 60 * 60 * 1000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCalendarAutoRefresh);
} else {
    initCalendarAutoRefresh();
}

