(function () {
  var slider = document.getElementById('bother');
  var readout = document.getElementById('bother-value');
  if (slider && readout) {
    var sync = function () {
      readout.textContent = slider.value;
    };
    slider.addEventListener('input', sync);
    slider.addEventListener('change', sync);
    sync();
  }

  var printButton = document.getElementById('print-button');
  if (printButton) {
    printButton.addEventListener('click', function () {
      window.print();
    });
  }

  var autos = document.querySelectorAll('form[data-autosubmit]');
  for (var i = 0; i < autos.length; i += 1) {
    var form = autos[i];
    var box = form.querySelector('input[type="checkbox"]');
    if (!box) continue;
    box.addEventListener('change', function (event) {
      var parent = event.target.form;
      if (parent) parent.submit();
    });
  }
})();
