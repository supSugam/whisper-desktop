use std::sync::{Arc, Mutex};

// Wrapper to force Send on cpal::Stream (Mac-specific workaround)
pub struct SendStream(pub cpal::Stream);
unsafe impl Send for SendStream {}

pub struct AudioState {
    pub stream: Arc<Mutex<Option<SendStream>>>,
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
