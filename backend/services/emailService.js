import nodemailer from 'nodemailer';

let transporter = null;

/**
 * Initialize email service
 */
export const initializeEmailService = () => {
    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
            console.warn('⚠️  Email credentials not found. Email features will be disabled.');
            return false;
        }

        transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        console.log('✅ Email service initialized');
        return true;
    } catch (error) {
        console.error(`❌ Email Service Error: ${error.message}`);
        return false;
    }
};

/**
 * Send group invitation email
 * @param {string} recipientEmail - Email address of the invitee
 * @param {string} recipientName - Name of the invitee
 * @param {Object} group - Group object
 * @param {string} inviterName - Name of person sending invitation
 */
export const sendGroupInvitation = async (recipientEmail, recipientName, group, inviterName) => {
    if (!transporter) {
        console.warn('Email service not initialized. Skipping invitation email.');
        return { success: false, message: 'Email service not configured' };
    }

    try {
        const mailOptions = {
            from: `CircSave <${process.env.EMAIL_USER}>`,
            to: recipientEmail,
            subject: `You've been invited to join ${group.name} on CircSave`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4F46E5;">CircSave Group Invitation</h2>
                    <p>Hi ${recipientName},</p>
                    <p><strong>${inviterName}</strong> has invited you to join the savings group <strong>${group.name}</strong>.</p>
                    
                    <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0;">Group Details:</h3>
                        <p><strong>Group Name:</strong> ${group.name}</p>
                        <p><strong>Contribution Amount:</strong> ₦${group.contributionAmount.toLocaleString()}</p>
                        <p><strong>Frequency:</strong> ${group.contributionFrequency}</p>
                        <p><strong>Duration:</strong> ${group.contributionPeriodMonths} months</p>
                        <p><strong>Join Code:</strong> <span style="font-size: 24px; font-weight: bold; color: #4F46E5;">${group.joinCode}</span></p>
                    </div>
                    
                    <p>To join this group, log in to CircSave and use the join code above.</p>
                    
                    <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
                        This is an automated message from CircSave. Please do not reply to this email.
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return { success: true, message: 'Invitation sent successfully' };
    } catch (error) {
        console.error('Error sending invitation email:', error);
        return { success: false, message: error.message };
    }
};

/**
 * Send contribution reminder email
 * @param {string} recipientEmail - Email address
 * @param {string} recipientName - Name of recipient
 * @param {Object} group - Group object
 * @param {number} cycleNumber - Current cycle number
 * @param {Date} dueDate - Due date for contribution
 */
export const sendContributionReminder = async (recipientEmail, recipientName, group, cycleNumber, dueDate) => {
    if (!transporter) {
        return { success: false, message: 'Email service not configured' };
    }

    try {
        const formattedDueDate = new Date(dueDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const mailOptions = {
            from: `CircSave <${process.env.EMAIL_USER}>`,
            to: recipientEmail,
            subject: `Contribution Reminder - ${group.name}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4F46E5;">Contribution Reminder</h2>
                    <p>Hi ${recipientName},</p>
                    <p>This is a friendly reminder that your contribution for <strong>${group.name}</strong> is due soon.</p>
                    
                    <div style="background-color: #FEF3C7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F59E0B;">
                        <p><strong>Cycle:</strong> ${cycleNumber}</p>
                        <p><strong>Amount Due:</strong> ₦${group.contributionAmount.toLocaleString()}</p>
                        <p><strong>Due Date:</strong> ${formattedDueDate}</p>
                    </div>
                    
                    <p>Please make your payment and upload your receipt on CircSave to avoid late penalties.</p>
                    
                    <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
                        This is an automated message from CircSave.
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return { success: true, message: 'Reminder sent successfully' };
    } catch (error) {
        console.error('Error sending reminder email:', error);
        return { success: false, message: error.message };
    }
};

/**
 * Send verification notification email
 * @param {string} recipientEmail - Email address
 * @param {string} recipientName - Name of recipient
 * @param {Object} contribution - Contribution object
 * @param {string} status - 'approved' or 'rejected'
 */
export const sendVerificationNotification = async (recipientEmail, recipientName, contribution, status) => {
    if (!transporter) {
        return { success: false, message: 'Email service not configured' };
    }

    try {
        const isApproved = status === 'approved';
        const statusColor = isApproved ? '#10B981' : '#EF4444';
        const statusText = isApproved ? 'Approved' : 'Rejected';

        const mailOptions = {
            from: `CircSave <${process.env.EMAIL_USER}>`,
            to: recipientEmail,
            subject: `Contribution ${statusText} - CircSave`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: ${statusColor};">Contribution ${statusText}</h2>
                    <p>Hi ${recipientName},</p>
                    <p>Your contribution has been <strong style="color: ${statusColor};">${statusText.toLowerCase()}</strong> by the group admin.</p>
                    
                    <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Amount:</strong> ₦${contribution.amount.toLocaleString()}</p>
                        <p><strong>Cycle:</strong> ${contribution.cycleNumber}</p>
                        <p><strong>Status:</strong> <span style="color: ${statusColor};">${statusText}</span></p>
                        ${contribution.notes ? `<p><strong>Notes:</strong> ${contribution.notes}</p>` : ''}
                    </div>
                    
                    ${!isApproved ? '<p>Please contact your group admin for more information or resubmit your contribution.</p>' : '<p>Thank you for your contribution!</p>'}
                    
                    <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
                        This is an automated message from CircSave.
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return { success: true, message: 'Notification sent successfully' };
    } catch (error) {
        console.error('Error sending verification notification:', error);
        return { success: false, message: error.message };
    }
};

/**
 * Send grace period warning to a member who failed to contribute.
 * @param {string} recipientEmail
 * @param {string} recipientName
 * @param {Object} group
 * @param {Date|string} graceDeadline - Last day to fund wallet and retry
 * @param {number} amountKobo - Amount needed, in kobo
 */
export const sendGraceWarningNotification = async (recipientEmail, recipientName, group, graceDeadline, amountKobo) => {
    if (!transporter) {
        console.warn('Email service not initialized. Skipping grace warning email.');
        return { success: false, message: 'Email service not configured' };
    }

    try {
        const formattedDeadline = new Date(graceDeadline).toLocaleDateString('en-NG', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const amountNaira = (amountKobo / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' });

        const mailOptions = {
            from: `CircSave <${process.env.EMAIL_USER}>`,
            to: recipientEmail,
            subject: `⚠️ Action Required — Fund Your Wallet for ${group.name}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #F59E0B;">Contribution Grace Period Active</h2>
                    <p>Hi ${recipientName},</p>
                    <p>Your automatic contribution deduction for <strong>${group.name}</strong> failed due to insufficient wallet balance.</p>

                    <div style="background-color: #FEF3C7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F59E0B;">
                        <p><strong>Amount Required:</strong> ${amountNaira}</p>
                        <p><strong>Grace Period Deadline:</strong> ${formattedDeadline}</p>
                    </div>

                    <p>Please <strong>fund your CircSave wallet</strong> before the deadline. The system will automatically retry your contribution once per day during this period.</p>
                    <p>If your wallet is not funded before the deadline, your contribution will be marked as <strong>overdue</strong> and the payout for your group will be delayed.</p>

                    <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
                        This is an automated message from CircSave.
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return { success: true, message: 'Grace warning sent successfully' };
    } catch (error) {
        console.error('Error sending grace warning email:', error);
        return { success: false, message: error.message };
    }
};

/**
 * Notify ALL group members that a payout has been delayed due to incomplete contribution.
 * @param {Array<{email: string, fullName: string}>} groupMembers - Array of member objects
 * @param {Object} group - Group document
 * @param {string} overdueUserName - Name of the member whose contribution is overdue
 */
export const sendPayoutDelayedNotification = async (groupMembers, group, overdueUserName) => {
    if (!transporter) {
        console.warn('Email service not initialized. Skipping payout delayed emails.');
        return { success: false, message: 'Email service not configured' };
    }

    const results = [];
    for (const member of groupMembers) {
        if (!member.email) continue;
        try {
            const mailOptions = {
                from: `CircSave <${process.env.EMAIL_USER}>`,
                to: member.email,
                subject: `⏸️ Payout Delayed — ${group.name}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #EF4444;">Group Payout Delayed</h2>
                        <p>Hi ${member.fullName || 'Member'},</p>
                        <p>The scheduled payout for <strong>${group.name}</strong> has been <strong>temporarily delayed</strong> because not all members have completed their contribution for the current cycle.</p>

                        <div style="background-color: #FEE2E2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #EF4444;">
                            <p><strong>Group:</strong> ${group.name}</p>
                            <p><strong>Reason:</strong> One or more members have an overdue contribution.</p>
                            <p><strong>Payout will resume</strong> automatically once all contributions are settled.</p>
                        </div>

                        <p>We appreciate your patience. CircSave is committed to ensuring fair and complete rotational payouts for all members.</p>

                        <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
                            This is an automated message from CircSave.
                        </p>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);
            results.push({ email: member.email, success: true });
        } catch (error) {
            console.error(`Error sending payout-delayed email to ${member.email}:`, error);
            results.push({ email: member.email, success: false, error: error.message });
        }
    }

    return { success: true, results };
};

// Initialize email service on module load
initializeEmailService();
