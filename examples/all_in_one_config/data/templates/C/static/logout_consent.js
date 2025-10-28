function approveConsent() {
    document.consentForm.consent.value = "true";
    document.consentForm.submit();
}
function denyConsent() {
    document.consentForm.consent.value = "false";
    document.consentForm.submit();
}

// register button event handlers
document.getElementById("btnApprove").addEventListener("click", approveConsent);
document.getElementById("btnDeny").addEventListener("click", denyConsent);