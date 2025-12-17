use std::sync::{Arc, Mutex};

pub struct AudioState {
    pub stream: Arc<Mutex<Option<cpal::Stream>>>,
    pub is_recording: Arc<Mutex<bool>>,
    pub max_amplitude: Arc<Mutex<f32>>,
}

impl AudioState {
    pub fn new() -> Self {
        Self {
            stream: Arc::new(Mutex::new(None)),
            is_recording: Arc::new(Mutex::new(false)),
            max_amplitude: Arc::new(Mutex::new(0.0)),
        }
    }
}
