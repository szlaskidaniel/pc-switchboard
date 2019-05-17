/**
 * Used to show notifications
 */

'use strict';

function showMessage(message, error = false) {
  if (!error) {
    $.toast({
      heading: "Success",
      text: message,
      position: "top-right",
      icon: "success",
      hideAfter: 8000,
      stack: 1
    });
  } else {
    $.toast({
      heading: "Error",
      text: message,
      position: "top-right",
      icon: "error",
      hideAfter: 8000,
      stack: 1
    });
  }
}
