// ============================================
// Contact Form Handler - Using EmailJS
// ============================================

// EmailJS Configuration
const EMAILJS_SERVICE_ID = 'service_lofcm8u';
const EMAILJS_TEMPLATE_ID = 'template_qk9oq1d';
const EMAILJS_PUBLIC_KEY = 'f0FOL-hL4sHXYNccj';

// Initialize EmailJS
(function(){
    if (typeof emailjs !== 'undefined') {
        emailjs.init(EMAILJS_PUBLIC_KEY);
    }
})();

document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitButton = contactForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            
            // Get form values
            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                inquiryType: document.getElementById('inquiryType').value,
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value,
                hearAbout: document.getElementById('hearAbout').value
            };
            
            // Update button state
            submitButton.textContent = 'Sending...';
            submitButton.disabled = true;
            
            try {
                // Prepare template parameters for EmailJS
                // IMPORTANT: In your EmailJS template settings, make sure:
                // - "To Email" is HARDCODED to: wisheslittle416@gmail.com (NOT a variable!)
                // - "From Email" can be: {{from_email}} (this is the submitter's email)
                const templateParams = {
                    from_name: formData.name,
                    from_email: formData.email,
                    phone: formData.phone || 'Not provided',
                    inquiry_type: formData.inquiryType,
                    subject: `[${formData.inquiryType.toUpperCase()}] ${formData.subject}`,
                    message: formData.message,
                    hear_about: formData.hearAbout || 'Not provided',
                    reply_to: formData.email
                };
                
                // Send email using EmailJS
                const response = await emailjs.send(
                    EMAILJS_SERVICE_ID,
                    EMAILJS_TEMPLATE_ID,
                    templateParams
                );
                
                if (response.status === 200) {
                    // Success
                    submitButton.textContent = 'Message Sent! ✓';
                    submitButton.style.backgroundColor = '#4caf50';
                    contactForm.reset();
                    
                    setTimeout(() => {
                        submitButton.textContent = originalText;
                        submitButton.disabled = false;
                        submitButton.style.backgroundColor = '';
                    }, 3000);
                } else {
                    throw new Error('Email sending failed');
                }
            } catch (error) {
                console.error('EmailJS error:', error);
                
                // Fallback to mailto
                const subject = encodeURIComponent(`[${formData.inquiryType.toUpperCase()}] ${formData.subject}`);
                const body = encodeURIComponent(
                    `Name: ${formData.name}\n` +
                    `Email: ${formData.email}\n` +
                    `Phone: ${formData.phone || 'Not provided'}\n` +
                    `Inquiry Type: ${formData.inquiryType}\n` +
                    `How did you hear about us: ${formData.hearAbout || 'Not provided'}\n\n` +
                    `Message:\n${formData.message}`
                );
                
                window.location.href = `mailto:wisheslittle416@gmail.com?subject=${subject}&body=${body}`;
                
                submitButton.textContent = 'Opening Email Client...';
                setTimeout(() => {
                    submitButton.textContent = originalText;
                    submitButton.disabled = false;
                }, 2000);
            }
        });
    }
});

