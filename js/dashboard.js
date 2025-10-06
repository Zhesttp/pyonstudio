document.addEventListener('DOMContentLoaded', () => {
    // Burger menu logic - должно работать на всех страницах с dashboard-layout
    const burgerMenu = document.querySelector('.burger-menu-dashboard');
    const layout = document.querySelector('.dashboard-layout');
    const sidebar = document.querySelector('.sidebar');

    if (burgerMenu && layout && sidebar) {
        burgerMenu.addEventListener('click', (event) => {
            event.stopPropagation();
            burgerMenu.classList.toggle('is-active');
            layout.classList.toggle('sidebar-open');
        });

        document.addEventListener('click', (event) => {
            if (layout.classList.contains('sidebar-open')) {
                const isClickInsideSidebar = sidebar.contains(event.target);
                const isClickOnBurger = burgerMenu.contains(event.target);

                if (!isClickInsideSidebar && !isClickOnBurger) {
                    burgerMenu.classList.remove('is-active');
                    layout.classList.remove('sidebar-open');
                }
            }
        });
    }

    // load user stats for dashboard - only for non-admin pages
    if((document.querySelector('.dashboard-layout')) 
       && !document.body.classList.contains('admin-page')){
      
      const loadUserData = async () => {
        const r = await fetch('/api/me');
        if (r.status !== 200) {
          location.href = '/login';
          return;
        }
        const data = await r.json();
        
        const nameEl=document.querySelector('.user-name');
        if(nameEl) nameEl.textContent=data.first_name||'';
        
        // Compute progress based on plan's total classes if present; otherwise use visits modulo 8
        const total = Number(data.total_classes)||8;
        const visits = Number(data.attended_classes)||0;
        const pct = Math.max(0, Math.min(100, Math.round((visits/total)*100)));
        
        const ring=document.getElementById('ring-progress');
        const pctText=document.getElementById('progress-percent');
        const progFill=document.getElementById('progress-fill');
        const progSummary=document.getElementById('progress-summary');
        
        if(ring){
          // Stroke dasharray expects value like "X 100" where X is percent
          ring.setAttribute('stroke-dasharray', `${pct} ${100-pct}`);
        }
        if(pctText){
          pctText.textContent = `${pct}%`;
        }
        if(progFill){
          progFill.style.width = pct + '%';
        }
        if(progSummary){
          progSummary.innerHTML = `Вы посетили <strong>${visits} из ${total}</strong> занятий в этом месяце`;
        }
        
        // Optional: next class subtitle based on upcoming classes endpoint
        const nextSub = document.getElementById('next-class-subtitle');
        try{
          const up = await fetch('/api/me/upcoming-classes');
          if(up.ok){
            const list = await up.json();
            if(Array.isArray(list) && list.length > 0){
              const it = list[0];
              const time = (it.start_time||'').slice(0,5);
              nextSub.textContent = `Ваша ближайшая тренировка: ${it.title} в ${time}`;
            } else {
              nextSub.textContent = 'У вас нету занятий в ближайшее время';
            }
          }
        }catch(_e){}
      };
      
      loadUserData().catch(() => {
        location.href = '/login';
      });
    }

    // Schedule page day switcher logic
    const schedulePage = document.querySelector('.schedule-page');
    if (schedulePage) {
        const daySwitcher = schedulePage.querySelector('.day-switcher');
        const dayColumns = schedulePage.querySelectorAll('.day-column');
        
        const todayColumn = schedulePage.querySelector('.day-column.today');
        let activeTab = null;
        let activeColumn = null;

        const setActiveDay = (day) => {
            if (activeTab) activeTab.classList.remove('active');
            if (activeColumn) activeColumn.classList.remove('active');

            const newActiveTab = schedulePage.querySelector(`.day-tab[data-day="${day}"]`);
            const newActiveColumn = schedulePage.querySelector(`.day-column[data-day="${day}"]`);

            if (newActiveTab && newActiveColumn) {
                newActiveTab.classList.add('active');
                newActiveColumn.classList.add('active');
                activeTab = newActiveTab;
                activeColumn = newActiveColumn;
            }
        };

        if (todayColumn) {
            const today = todayColumn.dataset.day;
            setActiveDay(today);
        } else if (dayColumns.length > 0) {
            setActiveDay(dayColumns[0].dataset.day);
        }

        daySwitcher.addEventListener('click', (e) => {
            if (e.target.classList.contains('day-tab')) {
                setActiveDay(e.target.dataset.day);
            }
        });
    }
});
