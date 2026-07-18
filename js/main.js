// Typing animation
const phrases = [
  "Data Science & Machine Learning",
  "Python · Pandas · Scikit-learn",
  "ECE Paris · Hanyang University 🇰🇷",
  "Ouvert à des collaborations en Data & IA ✨"
];
let pi = 0, ci = 0, deleting = false;
const el = document.getElementById('typed-text');

function type() {
  const phrase = phrases[pi];
  if (!deleting) {
    el.innerHTML = phrase.slice(0, ci + 1) + '<span class="cursor">|</span>';
    ci++;
    if (ci === phrase.length) { deleting = true; setTimeout(type, 1800); return; }
  } else {
    el.innerHTML = phrase.slice(0, ci - 1) + '<span class="cursor">|</span>';
    ci--;
    if (ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; setTimeout(type, 300); return; }
  }
  setTimeout(type, deleting ? 45 : 75);
}
type();

// Fade-in on scroll
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); } });
}, { threshold: 0.05, rootMargin: '0px 0px -30px 0px' });
document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

// Fallback : tout afficher après 1.5s si l'observer ne se déclenche pas
setTimeout(() => {
  document.querySelectorAll('.fade-up').forEach(el => el.classList.add('visible'));
}, 1500);

// Tilt 3D léger sur les cartes projets (souris fine uniquement, respecte prefers-reduced-motion)
const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (canHover && !noMotion) {
  document.querySelectorAll('.project-card').forEach(card => {
    card.style.transition = 'transform 0.15s ease-out, border-color 0.25s, box-shadow 0.25s';
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(900px) rotateY(${px * 7}deg) rotateX(${-py * 7}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
}
