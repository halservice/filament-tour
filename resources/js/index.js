import { driver } from "driver.js";
import { initCssSelector } from './css-selector.js';

// --- HELPER FUNCTIONS (Pure Logic) ---

const parseId = (params) => Array.isArray(params) ? params[0] : (params?.id || params);

const waitForElement = (selector, callback) => {
    const el = document.querySelector(selector);
    if (el) return callback(el);

    const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
            callback(el);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
};

// Gestisce tutti gli eventi (notifiche, redirect, dispatch) per evitare ripetizioni
const handleStepEvents = (events, type) => {
    if (!events) return;
    const suffix = type === 'next' ? 'Next' : 'Prev';

    // Notifications
    const notify = events[`notifyOn${suffix}`];
    if (notify && typeof FilamentNotification !== 'undefined') {
        new FilamentNotification()
            .title(notify.title)
            .body(notify.body)
            .icon(notify.icon)
            .iconColor(notify.iconColor)
            .color(notify.color)
            .duration(notify.duration)
            .send();
    }

    // Livewire Dispatch
    const dispatch = events[`dispatchOn${suffix}`];
    if (dispatch) Livewire.dispatch(dispatch.name, dispatch.params);

    // Click Element
    const clickSelector = events[`clickOn${suffix}`];
    if (clickSelector) document.querySelector(clickSelector)?.click();

    // Redirect
    const redirect = events[`redirectOn${suffix}`];
    if (redirect) window.open(redirect.url, redirect.newTab ? '_blank' : '_self');
};


// --- MAIN LOGIC ---

// Guard to avoid re-registering listeners on every Livewire navigation FIREFOX ISSUE!!!
window.filamentTourElementsLoaded = [];

async function eventHandler(event) {
    initCssSelector();

    let pluginData = null;
    let tours = [];
    let highlights = [];

    // Caricamento dati
    Livewire.dispatch('filament-tour::load-elements', { request: window.location });

    Livewire.on('filament-tour::loaded-elements', (data) => {
        if (window.filamentTourElementsLoaded.includes(data.current_route_name)) {
            pluginData = data;
            return;
        }

        window.filamentTourElementsLoaded.push(data.current_route_name);
        pluginData = data;
        tours.push(...data.tours);

        // Setup LocalStorage
        if (pluginData.history_type === 'local_storage' && !localStorage.getItem('tours')) {
            localStorage.setItem('tours', "[]");
        }

        // Auto Start
        if (pluginData.auto_start_tours !== false) {
            selectTour(tours);
        }

        // Render Highlights
        pluginData.highlights.forEach((highlight) => {
            if (highlight.route === window.location.pathname) {
                waitForElement(highlight.parent, (element) => {
                    element.parentNode.style.position = 'relative';
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = highlight.button;
                    tempDiv.firstChild.classList.add(highlight.position);
                    element.parentNode.insertBefore(tempDiv.firstChild, element);
                });
                highlights.push(highlight);
            }
        });
    });

    Livewire.on('filament-tour::open-highlight', (params) => {
        const id = parseId(params);
        const highlight = highlights.find(el => el.id === id);

        if (!highlight) return console.error(`Highlight with id '${id}' not found`);

        driver({
            overlayColor: localStorage.theme === 'light' ? highlight.colors.light : highlight.colors.dark,
            onPopoverRender: (popover, { state }) => {
                popover.title.innerText = state.activeStep.popover.title;
                if (!state.activeStep.popover.description) {
                    popover.title.style.justifyContent = 'center';
                }
                const classes = "dark:text-white fi-section rounded-xl bg-white shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10 mb-4";
                popover.footer.parentElement.classList.add(...classes.split(" "));
            },
        }).highlight(highlight);
    });

    Livewire.on('filament-tour::open-tour', (params) => {
        const id = parseId(params);
        const tour = tours.find(el => el.id === pluginData.prefix + id);
        tour ? openTour(tour) : console.error(`Tour with id '${id}' not found`);
    });

    Livewire.on('filament-tour::reset-tour', (params) => {
        const id = parseId(params);
        const tourId = pluginData.prefix + id;

        pluginData.completed_tours = pluginData.completed_tours.filter(item => item !== id);

        if (pluginData.history_type === 'local_storage') {
            const stored = JSON.parse(localStorage.getItem('tours') || "[]");
            localStorage.setItem('tours', JSON.stringify(stored.filter(item => item !== tourId)));
        }

        const tour = tours.find(el => el.id === tourId);
        tour ? openTour(tour) : console.error(`Tour with id '${id}' not found`);
    });

    // --- TOUR LOGIC FUNCTIONS ---

    function hasTourCompleted(id) {
        if (pluginData.history_type === 'local_storage') {
            return localStorage.getItem('tours').includes(id);
        }
        if (pluginData.history_type === 'database') {
            return pluginData.completed_tours.includes(id.replace(pluginData.prefix, ''));
        }
        return false;
    }

    function markTour(tour, status) {
        // Status: 'complete' or 'dismissed'
        const eventObj = status === 'complete' ? tour.dispatchOnComplete : tour.dispatchOnDismiss;
        const livewireEvent = status === 'complete' ? 'filament-tour::tour-completed' : 'filament-tour::tour-dismissed';

        if (eventObj) Livewire.dispatch(eventObj.name, eventObj.params);

        if (pluginData.history_type === 'database') {
            Livewire.dispatch(livewireEvent, { id: tour.id });
        } else if (status === 'complete' && pluginData.history_type === 'local_storage') {
            const current = JSON.parse(localStorage.getItem('tours'));
            localStorage.setItem('tours', JSON.stringify([...current, tour.id]));
        }
    }

    function selectTour(toursList, startIndex = 0) {
        for (let i = startIndex; i < toursList.length; i++) {
            const tour = toursList[i];
            const isMatch = (tour.route === window.location.pathname) || (tour.routeName === pluginData.current_route_name);
            const isDone = hasTourCompleted(tour.id);
            const showCondition = !pluginData.only_visible_once || !isDone;

            // Logica semplificata:
            // 1. AlwaysShow E (Ignored OR (NotIgnored AND Match))
            // 2. OR (Ignored AND ShowCondition)
            // 3. OR (Match AND ShowCondition)
            if (
                (tour.alwaysShow && (tour.routesIgnored || (!tour.routesIgnored && isMatch))) ||
                (tour.routesIgnored && showCondition) ||
                (isMatch && showCondition)
            ) {
                openTour(tour);
                break;
            }
        }
    }

    function openTour(tour) {
        const steps = JSON.parse(tour.steps);
        if (!steps.length) return;

        const driverObj = driver({
            allowClose: true,
            disableActiveInteraction: true,
            overlayColor: localStorage.theme === 'light' ? tour.colors.light : tour.colors.dark,
            nextBtnText: tour.nextButtonLabel,
            prevBtnText: tour.previousButtonLabel,
            doneBtnText: tour.doneButtonLabel,
            showProgress: tour.showProgress,
            progressText: tour.progressText,
            popoverClass: tour.popoverClass,

            onCloseClick: (el, step, { state }) => {
                const active = state.activeStep;
                if (active && (!active.uncloseable || tour.uncloseable)) {
                    if (!driverObj.isLastStep() && !hasTourCompleted(tour.id)) {
                        markTour(tour, tour.shouldCompleteOnDismiss ? 'complete' : 'dismissed');
                    }
                    driverObj.destroy();
                }
            },
            onDestroyStarted: (el, step, { state }) => {
                const active = state.activeStep;
                // Controllo sicurezza se step esiste
                if (active && !active.uncloseable && !tour.uncloseable) {
                    if (!driverObj.isLastStep()) {
                        markTour(tour, tour.shouldCompleteOnDismiss ? 'complete' : 'dismissed');
                    }
                    driverObj.destroy();
                }
            },
            onNextClick: (el, step) => {
                // Chain Tours
                if (tours.length > 1 && driverObj.isLastStep()) {
                    const index = tours.findIndex(t => t.id === tour.id);
                    if (index !== -1 && index < tours.length - 1) {
                        selectTour(tours, index + 1);
                    }
                }

                if (driverObj.isLastStep()) {
                    if (!hasTourCompleted(tour.id)) markTour(tour, 'complete');
                    driverObj.destroy();
                }

                handleStepEvents(step.events, 'next');
                driverObj.moveNext();
            },
            onPrevClick: (el, step) => {
                if (tours.length > 1 && driverObj.isFirstStep()) {
                    const index = tours.findIndex(t => t.id === tour.id);
                    if (index !== -1 && index > 0) {
                        selectTour(tours, index - 1);
                    }
                }

                handleStepEvents(step.events, 'prev');
                driverObj.movePrevious();
            },
            onPopoverRender: (popover, { state }) => {
                if (state.activeStep.uncloseable || tour.uncloseable) {
                    document.querySelector(".driver-popover-close-btn")?.remove();
                }
            },
            steps: steps,
        });

        driverObj.drive();
    }
}

document.addEventListener('livewire:navigated', eventHandler);
