document.addEventListener('DOMContentLoaded', () => {
    // load user stats for dashboard
    if(document.querySelector('.dashboard-page')||document.querySelector('.dashboard-layout')){
      fetch('/api/me').then(r=>{
        if(r.status!==200)return;
        return r.json();
      }).then(data=>{
        if(!data)return;
        const nameEl=document.querySelector('.user-name');
        if(nameEl) nameEl.textContent=data.first_name;
        const visitEl=document.querySelector('#stat-visits');
        if(visitEl) visitEl.textContent=data.visits_count||0;
        const minEl=document.querySelector('#stat-minutes');
        if(minEl) minEl.textContent=data.minutes_practice||0;
        const progTxt=document.getElementById('progress-text');
        const progFill=document.getElementById('progress-fill');
        if(progTxt&&progFill){
          const pct=Math.min(100,((data.visits_count||0)%8)/8*100);
          progTxt.textContent=`${data.visits_count%8}/8`;
          progFill.style.width=pct+'%';
        }
      }).catch(console.error);
    }
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
