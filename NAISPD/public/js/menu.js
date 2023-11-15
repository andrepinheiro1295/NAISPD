document.addEventListener('DOMContentLoaded', function () {
    var btnExp = document.querySelector('#btn-exp');
    var menuSide = document.querySelector('.menu-lateral');

    btnExp.addEventListener('click', function () {
        console.log("botão clicado"),
        menuSide.classList.toggle('expandir');
    });
});
