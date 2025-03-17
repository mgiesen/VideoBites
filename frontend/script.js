// Global variables
const API_BASE_URL = '/api';
let currentVideoInfo = null;
let currentJobId = null;
let currentSegments = [];
let completedSegments = [];
let statusCheckInterval = null;

// DOM elements
const videoUrlInput = document.getElementById('videoUrl');
const checkUrlBtn = document.getElementById('checkUrlBtn');
const urlCard = document.getElementById('urlCard');
const videoInfoCard = document.getElementById('videoInfoCard');
const videoThumbnail = document.getElementById('videoThumbnail');
const videoYoutubeLink = document.getElementById('videoYoutubeLink');
const videoTitle = document.getElementById('videoTitle');
const videoUploader = document.getElementById('videoUploader');
const videoUploadDate = document.getElementById('videoUploadDate');
const videoDuration = document.getElementById('videoDuration');
const videoViews = document.getElementById('videoViews');
const qualityCard = document.getElementById('qualityCard');
const qualitySelect = document.getElementById('qualitySelect');
const mergeSegmentsCheck = document.getElementById('mergeSegmentsCheck');
const parallelExtractionCheck = document.getElementById('parallelExtractionCheck');
const segmentsCard = document.getElementById('segmentsCard');
const segmentsHeader = document.getElementById('segmentsHeader');
const addSegmentBtn = document.getElementById('addSegmentBtn');
const addSegmentContainer = document.getElementById('addSegmentContainer');
const segmentsContainer = document.getElementById('segmentsContainer');
const extractBtnContainer = document.getElementById('extractBtnContainer');
const extractBtn = document.getElementById('extractBtn');
const mergedSegmentCard = document.getElementById('mergedSegmentCard');
const mergedSegmentContainer = document.getElementById('mergedSegmentContainer');
const newExtractionContainer = document.getElementById('newExtractionContainer');
const newExtractionBtn = document.getElementById('newExtractionBtn');
const videoPlayerModal = document.getElementById('videoPlayerModal');
const videoPlayer = document.getElementById('videoPlayer');
const videoDownloadBtn = document.getElementById('videoDownloadBtn');

// Event listeners
document.addEventListener('DOMContentLoaded', () =>
{
    checkUrlBtn.addEventListener('click', validateAndFetchVideoInfo);

    addSegmentBtn.addEventListener('click', function ()
    {
        addSegment(false);
    });

    extractBtn.addEventListener('click', function (event)
    {
        event.preventDefault();
        extractSegments();
    });

    newExtractionBtn.addEventListener('click', function ()
    {
        window.location.reload();
    });

    // Version laden
    loadVersionInfo();
});

// API Functions
async function callAPI(endpoint, method = 'GET', data = null)
{
    try
    {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        if (data) options.body = JSON.stringify(data);

        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        if (!response.ok)
        {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Ein Fehler ist aufgetreten');
        }
        return await response.json();
    } catch (error)
    {
        console.error('API Error:', error);
        showToast('error', `API-Fehler: ${error.message}`);
        throw error;
    }
}

// YouTube URL validation and info fetching
async function validateAndFetchVideoInfo()
{
    const url = videoUrlInput.value.trim();
    if (!url)
    {
        showToast('warning', 'Bitte gib eine YouTube-URL ein');
        return;
    }

    try
    {
        checkUrlBtn.disabled = true;
        checkUrlBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Prüfe...';

        const validateResponse = await callAPI('/validate', 'POST', { url });
        if (!validateResponse.valid)
        {
            showToast('error', 'Ungültige oder nicht verfügbare YouTube-URL');
            resetValidation();
            return;
        }

        currentVideoInfo = await callAPI('/info', 'POST', { url });
        displayVideoInfo(currentVideoInfo);

        qualityCard.style.display = 'block';
        segmentsCard.style.display = 'block';
        extractBtn.disabled = false;

        checkUrlBtn.disabled = false;
        checkUrlBtn.innerHTML = '<i class="fas fa-check me-1"></i> Prüfen';
        showToast('success', 'Video-Informationen erfolgreich geladen');
    }
    catch (error)
    {
        resetValidation();
    }
}

function resetValidation()
{
    checkUrlBtn.disabled = false;
    checkUrlBtn.innerHTML = '<i class="fas fa-check me-1"></i> Prüfen';
}

function displayVideoInfo(info)
{
    videoThumbnail.src = info.thumbnail;
    videoTitle.textContent = info.title;
    videoUploader.textContent = info.uploader;

    const videoId = getYouTubeId(videoUrlInput.value.trim());
    videoYoutubeLink.href = `https://www.youtube.com/watch?v=${videoId}`;

    const uploadDate = info.upload_date;
    const formattedDate = `${uploadDate.substring(6, 8)}.${uploadDate.substring(4, 6)}.${uploadDate.substring(0, 4)}`;
    videoUploadDate.textContent = formattedDate;

    const durationMin = Math.floor(info.duration / 60);
    const durationSec = info.duration % 60;
    videoDuration.textContent = `${durationMin}:${durationSec.toString().padStart(2, '0')}`;

    videoViews.textContent = info.view_count.toLocaleString('de-DE');
    videoInfoCard.style.display = 'block';

    updateSegmentTimeConstraints(info.duration);

    // Check if there are no segments yet, and add one
    if (document.querySelectorAll('.segment-item').length === 0)
    {
        addSegment(true);
    }
}

// Helper function to extract YouTube ID
function getYouTubeId(url)
{
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function parseTimeInput(timeStr)
{
    const parts = timeStr.split(':').map(part => parseInt(part) || 0);
    if (parts.length === 3)
    {
        // Format: HH:MM:SS
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2)
    {
        // Format: MM:SS
        return parts[0] * 60 + parts[1];
    }
    return 0;
}

// Segment management
function addSegment(isFirstElement = false)
{
    const segmentIndex = document.querySelectorAll('.segment-item').length;
    const maxDuration = currentVideoInfo ? currentVideoInfo.duration : 600;
    const deleteIcon = !isFirstElement ? '<button type="button" class="btn btn-sm btn-light remove-segment-btn" aria-label="Delete"><i class="fas fa-trash-alt"></i></button>' : '';

    // Make sure end time is at most 10 seconds or maxDuration if less
    const endTimeInitial = Math.min(maxDuration, 10);

    const segmentHtml = `
    <div class="segment-item" data-index="${segmentIndex}">
        <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="segment-title-container">
                <input type="text" class="segment-title-input" value="Segment ${segmentIndex + 1}" spellcheck="false">
            </div>
            ${deleteIcon}
        </div>
        <div class="segment-controls">
            <div class="time-input">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <label for="start-time-text-${segmentIndex}" class="time-label mb-1">Startzeit</label>
                    <div class="d-flex align-items-center mb-1">
                        <button class="btn btn-sm btn-outline-secondary time-stepper-btn me-2" data-action="decrease-start">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="text" id="start-time-text-${segmentIndex}" class="form-control time-text-input start-time-text" style="text-align: center;" placeholder="00:00" value="00:00">
                        <button class="btn btn-sm btn-outline-secondary time-stepper-btn ms-2" data-action="increase-start">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <label for="end-time-text-${segmentIndex}" class="time-label mb-1">Endzeit</label>
                    <div class="d-flex align-items-center mb-1">
                        <button class="btn btn-sm btn-outline-secondary time-stepper-btn me-2" data-action="decrease-end">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="text" id="end-time-text-${segmentIndex}" class="form-control time-text-input end-time-text" style="text-align: center;" placeholder="00:10" value="${formatTime(endTimeInitial)}">
                        <button class="btn btn-sm btn-outline-secondary time-stepper-btn ms-2" data-action="increase-end">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
                <div class="dual-range-slider">
                    <div class="dual-range-track"></div>
                    <div class="dual-range-progress"></div>
                    <div class="dual-range-handle" data-handle="start"></div>
                    <div class="dual-range-handle" data-handle="end"></div>
                </div>
                <div>
                    <span class="segment-duration">Dauer: ${formatDuration(endTimeInitial)}</span>
                </div>
            </div>
        </div>
    </div>
    `;

    segmentsContainer.insertAdjacentHTML('beforeend', segmentHtml);
    const newSegment = segmentsContainer.lastElementChild;

    const removeBtn = newSegment.querySelector('.remove-segment-btn');
    if (removeBtn)
    {
        removeBtn.addEventListener('click', function ()
        {
            removeSegment(newSegment);
        });
    }

    // Add empty title check on blur event
    const titleInput = newSegment.querySelector('.segment-title-input');
    titleInput.addEventListener('blur', function ()
    {
        // If the input is empty, reset to default title
        if (!this.value.trim())
        {
            const segmentIndex = parseInt(newSegment.getAttribute('data-index'));
            this.value = `Segment ${segmentIndex + 1}`;
        }
    });

    const startTimeTextInput = newSegment.querySelector('.start-time-text');
    const endTimeTextInput = newSegment.querySelector('.end-time-text');
    const durationSpan = newSegment.querySelector('.segment-duration');
    const dualRangeSlider = newSegment.querySelector('.dual-range-slider');
    const dualRangeProgress = newSegment.querySelector('.dual-range-progress');
    const startHandle = newSegment.querySelector('.dual-range-handle[data-handle="start"]');
    const endHandle = newSegment.querySelector('.dual-range-handle[data-handle="end"]');

    // Initialize values with exact integer values to avoid floating point issues
    let startValue = 0;
    let endValue = endTimeInitial;

    // Initial UI update
    updateDualRangeUI();
    updateSegmentDuration(startValue, endValue, durationSpan);

    function updateDualRangeUI()
    {
        // Calculate percentages for positions
        const startPercent = (startValue / maxDuration) * 100;
        const endPercent = (endValue / maxDuration) * 100;

        // Update handle positions
        startHandle.style.left = `${startPercent}%`;
        endHandle.style.left = `${endPercent}%`;

        // Update progress bar
        dualRangeProgress.style.left = `${startPercent}%`;
        dualRangeProgress.style.width = `${endPercent - startPercent}%`;
    }

    function updateAllUI()
    {
        // Update text inputs
        startTimeTextInput.value = formatTime(startValue);
        endTimeTextInput.value = formatTime(endValue);

        // Update slider
        updateDualRangeUI();

        // Update duration badge
        updateSegmentDuration(startValue, endValue, durationSpan);
    }

    // Handle text input changes
    startTimeTextInput.addEventListener('change', function ()
    {
        const inputTime = parseTimeInput(this.value);
        const minDuration = 1;

        // Ensure valid range and constraints
        startValue = Math.max(0, Math.min(inputTime, endValue - minDuration));
        updateAllUI();
    });

    endTimeTextInput.addEventListener('change', function ()
    {
        const inputTime = parseTimeInput(this.value);
        const minDuration = 1;

        // Ensure valid range and constraints
        endValue = Math.max(startValue + minDuration, Math.min(inputTime, maxDuration));
        updateAllUI();
    });

    // Dual handle slider drag functionality
    let activeHandle = null;
    let startX = 0;
    let startLeft = 0;

    function handleMouseDown(e)
    {
        e.preventDefault();
        activeHandle = e.target;

        startX = e.clientX;
        startLeft = parseFloat(activeHandle.style.left || (activeHandle.dataset.handle === 'start' ? '0' : '100'));

        activeHandle.classList.add('active');
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    function handleMouseMove(e)
    {
        if (!activeHandle) return;

        const rect = dualRangeSlider.getBoundingClientRect();
        const offsetX = e.clientX - startX;
        const percentDelta = (offsetX / rect.width) * 100;
        let newLeftPercent = Math.max(0, Math.min(100, startLeft + percentDelta));

        const minDuration = 1;
        const minDurationPercent = (minDuration / maxDuration) * 100;

        if (activeHandle.dataset.handle === 'start')
        {
            // Moving start handle
            const endPercent = parseFloat(endHandle.style.left || '100');

            // If start handle would push end handle
            if (newLeftPercent > endPercent - minDurationPercent)
            {
                // Push end handle as well, but respect maximum
                const newEndPercent = Math.min(100, newLeftPercent + minDurationPercent);
                endValue = Math.round((newEndPercent / 100) * maxDuration);

                // Adjust start position to maintain minimum gap
                newLeftPercent = Math.max(0, newEndPercent - minDurationPercent);
            }

            startValue = Math.round((newLeftPercent / 100) * maxDuration);
        } else
        {
            // Moving end handle
            const startPercent = parseFloat(startHandle.style.left || '0');

            // If end handle would push start handle
            if (newLeftPercent < startPercent + minDurationPercent)
            {
                // Push start handle as well, but respect minimum
                const newStartPercent = Math.max(0, newLeftPercent - minDurationPercent);
                startValue = Math.round((newStartPercent / 100) * maxDuration);

                // Adjust end position to maintain minimum gap
                newLeftPercent = Math.max(newStartPercent + minDurationPercent, newLeftPercent);
            }

            endValue = Math.min(Math.round((newLeftPercent / 100) * maxDuration), maxDuration);
        }

        updateAllUI();
    }

    function handleMouseUp()
    {
        if (activeHandle)
        {
            activeHandle.classList.remove('active');
            activeHandle = null;
        }
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }

    // Touch events for mobile support
    function handleTouchStart(e)
    {
        const touch = e.touches[0];
        activeHandle = e.target;

        startX = touch.clientX;
        startLeft = parseFloat(activeHandle.style.left || (activeHandle.dataset.handle === 'start' ? '0' : '100'));

        activeHandle.classList.add('active');
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);
        e.preventDefault();
    }

    function handleTouchMove(e)
    {
        if (!activeHandle) return;

        const touch = e.touches[0];
        const rect = dualRangeSlider.getBoundingClientRect();
        const offsetX = touch.clientX - startX;
        const percentDelta = (offsetX / rect.width) * 100;
        let newLeftPercent = Math.max(0, Math.min(100, startLeft + percentDelta));

        const minDuration = 1;
        const minDurationPercent = (minDuration / maxDuration) * 100;

        if (activeHandle.dataset.handle === 'start')
        {
            // Moving start handle
            const endPercent = parseFloat(endHandle.style.left || '100');

            // If start handle would push end handle
            if (newLeftPercent > endPercent - minDurationPercent)
            {
                // Push end handle as well, but respect maximum
                const newEndPercent = Math.min(100, newLeftPercent + minDurationPercent);
                endValue = Math.round((newEndPercent / 100) * maxDuration);

                // Adjust start position to maintain minimum gap
                newLeftPercent = Math.max(0, newEndPercent - minDurationPercent);
            }

            startValue = Math.round((newLeftPercent / 100) * maxDuration);
        } else
        {
            // Moving end handle
            const startPercent = parseFloat(startHandle.style.left || '0');

            // If end handle would push start handle
            if (newLeftPercent < startPercent + minDurationPercent)
            {
                // Push start handle as well, but respect minimum
                const newStartPercent = Math.max(0, newLeftPercent - minDurationPercent);
                startValue = Math.round((newStartPercent / 100) * maxDuration);

                // Adjust end position to maintain minimum gap
                newLeftPercent = Math.max(newStartPercent + minDurationPercent, newLeftPercent);
            }

            endValue = Math.min(Math.round((newLeftPercent / 100) * maxDuration), maxDuration);
        }

        updateAllUI();
        e.preventDefault();
    }

    function handleTouchEnd()
    {
        if (activeHandle)
        {
            activeHandle.classList.remove('active');
            activeHandle = null;
        }
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
    }

    // Add event listeners for drag
    startHandle.addEventListener('mousedown', handleMouseDown);
    endHandle.addEventListener('mousedown', handleMouseDown);
    startHandle.addEventListener('touchstart', handleTouchStart);
    endHandle.addEventListener('touchstart', handleTouchStart);

    // Button controls
    const decreaseStartBtn = newSegment.querySelector('[data-action="decrease-start"]');
    const increaseStartBtn = newSegment.querySelector('[data-action="increase-start"]');
    const decreaseEndBtn = newSegment.querySelector('[data-action="decrease-end"]');
    const increaseEndBtn = newSegment.querySelector('[data-action="increase-end"]');

    decreaseStartBtn.addEventListener('click', () =>
    {
        startValue = Math.max(0, startValue - 1);
        updateAllUI();
    });

    increaseStartBtn.addEventListener('click', () =>
    {
        const minDuration = 1;
        startValue = Math.min(endValue - minDuration, startValue + 1);
        updateAllUI();
    });

    decreaseEndBtn.addEventListener('click', () =>
    {
        const minDuration = 1;
        endValue = Math.max(startValue + minDuration, endValue - 1);
        updateAllUI();
    });

    increaseEndBtn.addEventListener('click', () =>
    {
        endValue = Math.min(maxDuration, endValue + 1);
        updateAllUI();
    });

    updateExtractButtonState();
}

function removeSegment(segmentElement)
{
    segmentElement.remove();
    const segments = document.querySelectorAll('.segment-item');
    segments.forEach((segment, index) =>
    {
        segment.setAttribute('data-index', index);

        // Get the existing title input and preserve its content if it's not the default
        const titleInput = segment.querySelector('.segment-title-input');
        if (titleInput)
        {
            const currentTitle = titleInput.value.trim();
            // Only update if it's the default pattern "Segment X"
            if (/^Segment \d+$/.test(currentTitle))
            {
                titleInput.value = `Segment ${index + 1}`;
            }
        }
    });
    updateExtractButtonState();
}

function updateSegmentTimeConstraints(maxDuration)
{
    const segments = document.querySelectorAll('.segment-item');
    segments.forEach(segment =>
    {
        const startTimeTextInput = segment.querySelector('.start-time-text');
        const endTimeTextInput = segment.querySelector('.end-time-text');
        const durationSpan = segment.querySelector('.segment-duration');
        const startHandle = segment.querySelector('.dual-range-handle[data-handle="start"]');
        const endHandle = segment.querySelector('.dual-range-handle[data-handle="end"]');
        const dualRangeProgress = segment.querySelector('.dual-range-progress');

        // Get current positions as percentages
        let startPercent = parseFloat(startHandle.style.left) || 0;
        let endPercent = parseFloat(endHandle.style.left) || Math.min(100, (10 / maxDuration) * 100);

        // Convert to seconds
        let start = Math.round((startPercent / 100) * maxDuration);
        let end = Math.round((endPercent / 100) * maxDuration);

        // Enforce constraints
        if (start > maxDuration - 1) start = maxDuration - 1;
        if (end > maxDuration) end = maxDuration;
        if (end - start < 1) end = start + 1;

        // Convert back to percentages
        startPercent = (start / maxDuration) * 100;
        endPercent = (end / maxDuration) * 100;

        // Update text inputs
        startTimeTextInput.value = formatTime(start);
        endTimeTextInput.value = formatTime(end);

        // Update slider
        startHandle.style.left = `${startPercent}%`;
        endHandle.style.left = `${endPercent}%`;
        dualRangeProgress.style.left = `${startPercent}%`;
        dualRangeProgress.style.width = `${endPercent - startPercent}%`;

        // Update duration
        updateSegmentDuration(start, end, durationSpan);
    });
}

function formatDuration(seconds)
{
    seconds = Math.round(seconds); // Ensure we're working with whole numbers
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0)
    {
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else
    {
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

function updateSegmentDuration(start, end, durationSpan)
{
    const duration = Math.round(end - start);
    durationSpan.textContent = `Dauer: ${formatDuration(duration)}`;
}

function updateExtractButtonState()
{
    const segments = document.querySelectorAll('.segment-item');
    extractBtn.disabled = segments.length === 0 || !currentVideoInfo;
}

// Extraction process
async function extractSegments()
{
    const segmentElements = document.querySelectorAll('.segment-item');
    if (segmentElements.length === 0)
    {
        showToast('warning', 'Füge mindestens ein Segment hinzu');
        return;
    }

    const segments = [];
    let hasErrors = false;

    segmentElements.forEach(segmentElement =>
    {
        const startTimeStr = segmentElement.querySelector('.start-time-text').value;
        const endTimeStr = segmentElement.querySelector('.end-time-text').value;

        const startTime = parseTimeInput(startTimeStr);
        const endTime = parseTimeInput(endTimeStr);

        const title = segmentElement.querySelector('.segment-title-input').value.trim();

        if (isNaN(startTime) || isNaN(endTime) || endTime <= startTime)
        {
            hasErrors = true;
            return;
        }
        segments.push({
            start: startTime,
            end: endTime,
            title: title
        });
    });

    if (hasErrors)
    {
        showToast('error', 'Ungültige Zeitangaben in einem oder mehreren Segmenten');
        return;
    }

    currentSegments = segments;
    completedSegments = [];

    enterExtractionMode();
    updateSegmentsToLoadingState();

    try
    {
        const extractResponse = await callAPI('/extract', 'POST', {
            url: videoUrlInput.value.trim(),
            segments: segments,
            quality: qualitySelect.value,
            mergeSegments: mergeSegmentsCheck.checked,
            parallelExtraction: parallelExtractionCheck.checked
        });
        currentJobId = extractResponse.jobId;
        startStatusPolling(currentJobId);
    } catch (error)
    {
        showToast('error', `Fehler beim Starten der Extraktion: ${error.message}`);
        exitExtractionMode();
    }
}

function enterExtractionMode()
{
    urlCard.style.display = 'none';
    qualityCard.style.display = 'none';

    segmentsHeader.style.display = 'none';
    addSegmentContainer.style.display = 'none';
    extractBtnContainer.style.display = 'none';

    document.querySelectorAll('.remove-segment-btn').forEach(btn => btn.style.display = 'none');
    document.querySelectorAll('.start-time-text, .end-time-text, .time-text-input, .time-stepper-btn').forEach(input => input.disabled = true);
}

function exitExtractionMode()
{
    urlCard.style.display = 'block';
    qualityCard.style.display = 'block';

    segmentsHeader.style.display = 'flex';
    addSegmentContainer.style.display = 'block';
    extractBtnContainer.style.display = 'block';

    document.querySelectorAll('.remove-segment-btn').forEach(btn => btn.style.display = 'block');
    document.querySelectorAll('.start-time-text, .end-time-text, .time-text-input, .time-stepper-btn').forEach(input => input.disabled = false);
}

function updateSegmentsToLoadingState()
{
    segmentsContainer.innerHTML = '';

    currentSegments.forEach((segment, index) =>
    {
        const duration = segment.end - segment.start;
        const segmentTitle = segment.title || `Segment ${index + 1}`;
        const loadingSegmentHtml = `
                <div class="segment-item segment-loading" data-index="${index}">
                    <div class="spinner-container">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Lädt...</span>
                        </div>
                        <p class="spinner-text mb-0">${segmentTitle} wird extrahiert...</p>
                        <div class="mt-2">
                            <small class="text-muted">
                                Startzeit: ${formatTime(segment.start)} | 
                                Endzeit: ${formatTime(segment.end)} | 
                                Dauer: ${formatDuration(duration)}
                            </small>
                        </div>
                    </div>
                </div>
            `;
        segmentsContainer.insertAdjacentHTML('beforeend', loadingSegmentHtml);
    });

    const docSegmentHtml = `
        <div class="segment-item segment-loading" id="documentation-segment">
            <div class="spinner-container">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Lädt...</span>
                </div>
                <p class="spinner-text mb-0">Quellendokumentation wird erstellt...</p>
                <div class="mt-2">
                    <small class="text-muted">
                        Metadaten und Segmentinformationen
                    </small>
                </div>
            </div>
        </div>
    `;
    segmentsContainer.insertAdjacentHTML('beforeend', docSegmentHtml);

    if (mergeSegmentsCheck.checked && currentSegments.length > 1)
    {
        const totalDuration = currentSegments.reduce((total, segment) => total + (segment.end - segment.start), 0);
        mergedSegmentCard.style.display = 'block';
        mergedSegmentContainer.innerHTML = `
            <div class="segment-item segment-loading segment-merged" data-merged="true">
                <div class="spinner-container">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Lädt...</span>
                    </div>
                    <p class="spinner-text mb-0">Zusammenschnitt wird erstellt...</p>
                    <div class="mt-2">
                        <small class="text-muted">
                            Gesamtdauer: ${formatDuration(totalDuration)} | 
                            Segmente: ${currentSegments.length}
                        </small>
                    </div>
                </div>
            </div>
        `;
    }
}

async function previewDocumentation()
{
    try
    {
        const response = await fetch(`${API_BASE_URL}/documentation/${currentJobId}`);
        if (!response.ok)
        {
            throw new Error('Dokumentation konnte nicht abgerufen werden');
        }

        const documentation = await response.json();

        // Modal für die Vorschau erstellen, falls es noch nicht existiert
        let jsonModalEl = document.getElementById('jsonPreviewModal');
        if (!jsonModalEl)
        {
            jsonModalEl = document.createElement('div');
            jsonModalEl.id = 'jsonPreviewModal';
            jsonModalEl.className = 'modal fade';
            jsonModalEl.setAttribute('tabindex', '-1');
            jsonModalEl.setAttribute('aria-labelledby', 'jsonPreviewModalLabel');
            jsonModalEl.setAttribute('aria-hidden', 'true');

            jsonModalEl.innerHTML = `
                <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="jsonPreviewModalLabel">Quellendokumentation Vorschau</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <pre id="jsonPreviewContent" class="bg-light p-3 rounded" style="max-height: 70vh; overflow: auto;"></pre>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Schließen</button>
                            <button type="button" class="btn btn-primary" id="jsonDownloadBtn">
                                <i class="fas fa-download me-1"></i> Herunterladen
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(jsonModalEl);

            // Download-Button im Modal
            document.getElementById('jsonDownloadBtn').addEventListener('click', function ()
            {
                downloadDocumentation();
            });
        }

        // JSON in das Modal einfügen und formatieren
        document.getElementById('jsonPreviewContent').textContent = JSON.stringify(documentation, null, 2);

        // Modal anzeigen
        const jsonModal = new bootstrap.Modal(jsonModalEl);
        jsonModal.show();

    } catch (error)
    {
        console.error('Fehler beim Laden der Dokumentation:', error);
        showToast('error', 'Fehler beim Laden der Dokumentation');
    }
}

async function directDownload(index)
{
    const segmentInfo = completedSegments.find(seg => seg.index === index);
    if (!segmentInfo) return;

    const downloadUrl = `${API_BASE_URL}/download/${currentJobId}/${index}`;

    // Erstelle einen temporären Link und klicke ihn automatisch
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = '';  // Server liefert den Dateinamen
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast('info', 'Download gestartet');
}

function updateSegmentToReadyState(index, filePath)
{
    const segment = currentSegments[index];
    const duration = segment.end - segment.start;
    const segmentElement = document.querySelector(`.segment-item[data-index="${index}"]`);
    if (segmentElement)
    {
        segmentElement.className = 'segment-item segment-ready';
        segmentElement.innerHTML = `
            <div class="segment-info">
                <h6 class="mb-1">${segment.title || `Segment ${index + 1}`}</h6>
                <p class="mb-0 text-muted">
                    Startzeit: ${formatTime(segment.start)} | 
                    Endzeit: ${formatTime(segment.end)} | 
                    Dauer: ${formatDuration(duration)}
                </p>
            </div>
            <div class="segment-actions">
                <button class="btn-video play-btn me-2" data-index="${index}" title="Abspielen">
                    <i class="fas fa-play"></i>
                </button>
                <button class="btn-video download-btn" data-index="${index}" title="Herunterladen">
                    <i class="fas fa-download"></i>
                </button>
            </div>
        `;

        // Play-Button Event Listener
        segmentElement.querySelector('.play-btn').addEventListener('click', function ()
        {
            playVideo(index);
        });

        // Download-Button Event Listener
        segmentElement.querySelector('.download-btn').addEventListener('click', function ()
        {
            directDownload(index);
        });
    }
}

function updateMergedSegmentToReadyState(result)
{
    const segment = result.segment;
    const duration = segment.end - segment.start;

    mergedSegmentContainer.innerHTML = `
        <div class="segment-item segment-ready segment-merged" data-merged="true">
            <div class="segment-info">
                <h6 class="mb-1">Zusammenschnitt aller Segmente</h6>
                <p class="mb-0 text-muted">
                    Gesamtdauer: ${formatDuration(duration)} | 
                    Segmente: ${currentSegments.length}
                </p>
            </div>
            <div class="segment-actions">
                <button class="btn-video play-btn me-2" data-merged="true" title="Abspielen">
                    <i class="fas fa-play"></i>
                </button>
                <button class="btn-video download-btn" data-merged="true" title="Herunterladen">
                    <i class="fas fa-download"></i>
                </button>
            </div>
        </div>
    `;

    // Play-Button Event Listener
    mergedSegmentContainer.querySelector('.play-btn').addEventListener('click', function ()
    {
        playVideo(currentSegments.length);
    });

    // Download-Button Event Listener
    mergedSegmentContainer.querySelector('.download-btn').addEventListener('click', function ()
    {
        directDownload(currentSegments.length);
    });
}

function updateDocumentationToReadyState()
{
    const docElement = document.getElementById('documentation-segment');
    if (docElement)
    {
        docElement.className = 'segment-item segment-ready';
        docElement.innerHTML = `
            <div class="segment-info">
                <h6 class="mb-1">Quellendokumentation</h6>
                <p class="mb-0 text-muted">
                    Enthält umfassende Metadaten und Segmentinformationen
                </p>
            </div>
            <div class="segment-actions">
                <button class="btn-video preview-btn me-2" id="previewDocBtn" title="Vorschau">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-video download-btn" id="downloadDocBtn" title="Herunterladen">
                    <i class="fas fa-download"></i>
                </button>
            </div>
        `;

        // Download-Button Event Listener
        document.getElementById('downloadDocBtn').addEventListener('click', function ()
        {
            downloadDocumentation();
        });

        // Vorschau-Button Event Listener
        document.getElementById('previewDocBtn').addEventListener('click', function ()
        {
            previewDocumentation();
        });
    }
}

async function downloadDocumentation()
{
    try
    {
        const response = await fetch(`${API_BASE_URL}/documentation/${currentJobId}`);
        if (!response.ok)
        {
            throw new Error('Dokumentation konnte nicht abgerufen werden');
        }

        const documentation = await response.json();
        const blob = new Blob([JSON.stringify(documentation, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `videobites_dokumentation_${documentation.videoInfo.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('success', 'Dokumentation heruntergeladen');
    } catch (error)
    {
        console.error('Fehler beim Herunterladen der Dokumentation:', error);
        showToast('error', 'Fehler beim Herunterladen der Dokumentation');
    }
}

function startStatusPolling(jobId)
{
    if (statusCheckInterval) clearInterval(statusCheckInterval);
    statusCheckInterval = setInterval(async () =>
    {
        try
        {
            const status = await callAPI(`/status/${jobId}`);
            if (status.status === 'completed')
            {
                handleCompletedJob(status);
            } else if (status.status === 'failed')
            {
                clearInterval(statusCheckInterval);
                showToast('error', `Extraktion fehlgeschlagen: ${status.error || 'Unbekannter Fehler'}`);
                exitExtractionMode();
            } else if (status.result && Array.isArray(status.result))
            {
                updateCompletedSegments(status.result);
            }
        } catch (error)
        {
            console.error('Status check error:', error);
        }
    }, 2000);
}

function updateCompletedSegments(results)
{
    if (!results) return;

    results.forEach((result, index) =>
    {
        // Nur Segmente mit einer fertigen Datei aktualisieren
        if (result.filePath)
        {
            if (result.segment && result.segment.isMerged)
            {
                updateMergedSegmentToReadyState(result);
                // Speichern für den Download/Stream-Index
                completedSegments.push({ index: currentSegments.length, type: result.type });
            }
            else if (!completedSegments.some(seg => seg.index === index))
            {
                completedSegments.push({ index, type: result.type });
                updateSegmentToReadyState(index, result.filePath);
            }
        }
    });
}

function handleCompletedJob(status)
{
    clearInterval(statusCheckInterval);
    if (status.result && Array.isArray(status.result)) updateCompletedSegments(status.result);

    // Prüfen, ob Dokumentation verfügbar ist
    if (status.documentation)
    {
        updateDocumentationToReadyState();
    }

    newExtractionContainer.style.display = 'block';
    showToast('success', 'Alle Segmente wurden erfolgreich extrahiert');
}

function playVideo(index)
{
    const segmentInfo = completedSegments.find(seg => seg.index === index);
    if (!segmentInfo) return;

    const isAudio = segmentInfo.type === "audio";
    const streamUrl = `${API_BASE_URL}/stream/${currentJobId}/${index}`;
    const downloadUrl = `${API_BASE_URL}/download/${currentJobId}/${index}`;

    const videoModalEl = document.getElementById("videoPlayerModal");
    const videoModal = new bootstrap.Modal(videoModalEl);

    const videoPlayer = document.getElementById("videoPlayer");

    if (isAudio)
    {
        videoPlayer.src = "";
        videoPlayer.style.display = "none";

        let audioPlayer = document.getElementById("audioPlayer");
        if (!audioPlayer)
        {
            audioPlayer = document.createElement("audio");
            audioPlayer.id = "audioPlayer";
            audioPlayer.controls = true;
            audioPlayer.className = "w-100";
            videoModalEl.querySelector(".modal-body").appendChild(audioPlayer);
        }
        else
        {
            audioPlayer.style.display = "block";
        }
        audioPlayer.src = streamUrl;

        videoDownloadBtn.href = downloadUrl;
        videoModal.show();

        const isMerged = index === currentSegments.length;
        if (!isMerged)
        {
            const segment = currentSegments[index];
            const segmentTitle = segment.title || `Segment ${index + 1}`;
            document.getElementById("videoPlayerModalLabel").textContent = `${segmentTitle}: ${formatTime(segment.start)} - ${formatTime(segment.end)}`;
        }
        else
        {
            document.getElementById("videoPlayerModalLabel").textContent = "Zusammenschnitt aller Segmente";
        }

        videoModalEl.addEventListener("shown.bs.modal", function ()
        {
            audioPlayer.play().catch(error => console.error("Audio playback error:", error));
        });
        videoModalEl.addEventListener("hidden.bs.modal", function ()
        {
            audioPlayer.pause();
        });
    }
    else
    {
        videoPlayer.src = streamUrl;
        videoPlayer.style.display = "block";

        const audioPlayer = document.getElementById("audioPlayer");
        if (audioPlayer) audioPlayer.style.display = "none";

        videoDownloadBtn.href = downloadUrl;
        videoModal.show();

        const isMerged = index === currentSegments.length;
        if (!isMerged)
        {
            const segment = currentSegments[index];
            const segmentTitle = segment.title || `Segment ${index + 1}`;
            document.getElementById("videoPlayerModalLabel").textContent = `${segmentTitle}: ${formatTime(segment.start)} - ${formatTime(segment.end)}`;
        }
        else
        {
            document.getElementById("videoPlayerModalLabel").textContent = "Zusammenschnitt aller Segmente";
        }

        videoModalEl.addEventListener("shown.bs.modal", function ()
        {
            videoPlayer.play().catch(error => console.error("Video playback error:", error));
        });
        videoModalEl.addEventListener("hidden.bs.modal", function ()
        {
            videoPlayer.pause();
        });
    }
}

function formatTime(seconds)
{
    seconds = Math.round(seconds); // Round to nearest integer
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0)
    {
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else
    {
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

// Utility functions
function showToast(type, message)
{
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${getToastBackground(type)} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="fas ${getToastIcon(type)} me-2"></i>
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer)
    {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }

    toastContainer.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast, { autohide: true, delay: 5000 });
    bsToast.show();
    toast.addEventListener('hidden.bs.toast', function ()
    {
        toast.remove();
    });
}

function getToastBackground(type)
{
    switch (type)
    {
        case 'success': return 'success';
        case 'error': return 'danger';
        case 'warning': return 'warning';
        case 'info': return 'info';
        default: return 'primary';
    }
}

function getToastIcon(type)
{
    switch (type)
    {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        case 'info': return 'fa-info-circle';
        default: return 'fa-info-circle';
    }
}

async function loadVersionInfo()
{
    const versionText = document.getElementById('versionText');
    if (!versionText) return;

    try
    {
        const response = await fetch('version.json');
        if (!response.ok)
        {
            throw new Error('Versionsinformationen nicht verfügbar');
        }

        const versionInfo = await response.json();

        if (versionInfo.type === 'release')
        {
            // Release-Version als Link zur GitHub-Tag-Seite anzeigen
            const buildTime = new Date(versionInfo.buildTime).toLocaleString();
            const tagUrl = `https://github.com/mgiesen/VideoBites/releases/tag/${versionInfo.version}`;

            versionText.innerHTML = `<a href="${tagUrl}" target="_blank" title="Build: ${buildTime}" class="text-muted text-decoration-none">${versionInfo.version}</a>`;
        }
        else
        {
            // Entwicklungs-Version anzeigen
            versionText.innerHTML = `<span>Unveröffentlichte Version</span>`;
            versionText.classList.add('text-muted');
        }
    }
    catch (error)
    {
        console.error('Fehler beim Laden der Versionsinformationen:', error);
        versionText.innerHTML = 'Version unbekannt';
    }
}