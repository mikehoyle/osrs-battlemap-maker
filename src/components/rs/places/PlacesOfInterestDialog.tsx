import Modal from "react-modal";

import { PLACES_OF_INTEREST, PlaceOfInterest } from "../../../mapviewer/PlacesOfInterest";
import "./PlacesOfInterestDialog.css";

interface PlacesOfInterestDialogProps {
    isOpen: boolean;
    onRequestClose: () => void;
    onPlaceSelected: (place: PlaceOfInterest) => void;
}

Modal.setAppElement("#root");

export function PlacesOfInterestDialog({
    isOpen,
    onRequestClose,
    onPlaceSelected,
}: PlacesOfInterestDialogProps) {
    const handlePlaceClick = (place: PlaceOfInterest) => {
        onPlaceSelected(place);
        onRequestClose();
    };

    return (
        <Modal
            className="places-modal rs-border"
            overlayClassName="places-modal-overlay"
            isOpen={isOpen}
            onRequestClose={onRequestClose}
        >
            <div className="places-close-button" onClick={onRequestClose}></div>
            <div className="places-content">
                <h2 className="places-title">Places of Interest</h2>
                <div className="places-list">
                    {PLACES_OF_INTEREST.map((place) => (
                        <div
                            key={place.name}
                            className="places-item"
                            onClick={() => handlePlaceClick(place)}
                        >
                            {place.name}
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
}
