function continueButton() {
  var value = document.getElementById('usernameHolder').value.trim();
  if (value.length === 0) { throwError('Please type your username.'); return; }
  if (value.length > 24) { throwError('Username is too long (max 24 characters).'); return; }
  window.location.replace('/chat/api/setUsername/' + encodeURIComponent(value));
}

function throwError(error) {
  var toastLiveExample = document.getElementById('liveToast');
  var toastBootstrap = bootstrap.Toast.getOrCreateInstance(toastLiveExample);
  document.getElementById('toast-msg').textContent = error;
  toastBootstrap.show();
}