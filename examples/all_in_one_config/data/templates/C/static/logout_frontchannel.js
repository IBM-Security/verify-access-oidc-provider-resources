
function updateStatus(statusID) {
    document.getElementById(statusID).value = "success";
}
setTimeout('document.getElementById("statusForm").submit()', 3000); 