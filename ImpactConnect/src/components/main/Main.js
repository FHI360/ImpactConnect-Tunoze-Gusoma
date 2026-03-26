import { useAlert, useDataEngine, useDataQuery } from '@dhis2/app-runtime';
import i18n from '@dhis2/d2-i18n';
import { Pagination } from '@dhis2/ui';
import React, { useContext, useEffect, useState } from 'react';
import {
    ACTIVITY_STAGE_MAPPING,
    APP_GROUP,
    config,
    EVENT_OPTIONS,
    FACILITATOR_GROUP,
    MEL_TEAM_GROUP
} from '../../consts.js';
import {
    daysBetween,
    fetchEntities,
    filterDataValues,
    getParticipant,
    isObjectEmpty,
    paginate,
    prepareAndDownloadAttendance,
    searchEntities,
    SharedStateContext,
    sortEntities,
    trackerCreate
} from '../../utils.js';
import { DataElementComponent } from '../DataElement.js';
import { Navigation } from '../Navigation.js';
import NotFoundPage from '../NotFoundPage.js';
import { SearchComponent } from '../SearchComponent.js';
import { SpinnerComponent } from '../SpinnerComponent.js';
import { TrainingsComponent } from '../TrainingsComponent.js';

export const Main = () => {
    const engine = useDataEngine();

    const sharedState = useContext(SharedStateContext)

    const {
        setSelectedIsAdmin,
        setSelectedIsMEL,
        setSelectedIsFacilitator,
        selectedSharedIsMEL,
        selectedSharedIsFacilitator,
        selectedSharedIsAdmin
    } = sharedState;

    const [dataElements, setDataElements] = useState([]);
    const [trainingProgram, setTrainingProgram] = useState('');
    const [eventNameAttribute, setEventNameAttribute] = useState('');
    const [selectedTraining, setSelectedTraining] = useState('');
    const [stages, setStages] = useState([]);
    const [selectedStage, setSelectedStage] = useState('');
    const [orgUnits, setOrgUnits] = useState([]);
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(null);
    const [trainings, setTrainings] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [entities, setEntities] = useState([]);
    const [allEntities, setAllEntities] = useState([]);
    const [nameAttributes, setNameAttributes] = useState([]);
    const [groupEdit, setGroupEdit] = useState(false);
    const [edits, setEdits] = useState([]);
    const [originalEdits, setOriginalEdits] = useState([]);
    const [selectedEntities, setSelectedEntities] = useState([]);
    const [groupValues, setGroupValues] = useState({});
    const [pagedParticipants, setPagedParticipants] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [eventAttributes, setEventAttributes] = useState([]);
    const [scrollHeight, setScrollHeight] = useState('350px');
    const [eventsLoading, setEventsLoading] = useState(false);
    const [user, setUser] = useState('');
    const [root, setRoot] = useState('');
    const [groups, setGroups] = useState([]);
    const [venue, setVenue] = useState('');
    const [stageDataElements, setStageDataElements] = useState([]);
    const [eventName, setEventName] = useState('');

    const {show} = useAlert(
        ({msg}) => msg,
        ({type}) => ({[type]: true})
    )

    const dataStoreQuery = {
        dataStore: {
            resource: `dataStore/${config.dataStoreName}?fields=.`,
        }
    };

    const userQuery = {
        user: {
            resource: 'me',
            params: {
                fields: 'username, organisationUnits(id, root), userGroups(id, displayName, name)'
            }
        }
    }

    const dataElementsQuery = {
        programStage: {
            resource: `programStages`,
            params: ({
                fields: 'id, repeatable, programStageDataElements(dataElement(id, name, valueType, optionSet(id))'
            })
        }
    }

    const organisationsQuery = {
        orgUnits: {
            resource: `organisationUnits`,
            params: {
                fields: ['id', 'displayName'],
                paging: 'false',
            }
        }
    }

    const stageDataElementsQuery = {
        dataElements: {
            resource: 'programStages',
            params: {
                paging: false,
                fields: 'id,programStageDataElements(dataElement(id))'
            }
        }
    }

    const {
        data: elementsData
    } = useDataQuery(dataElementsQuery);

    const {data: dataStore} = useDataQuery(dataStoreQuery);

    const {data: orgUnitsData} = useDataQuery(organisationsQuery);

    const {data: userData} = useDataQuery(userQuery);

    const {data: stagesDataElements} = useDataQuery(stageDataElementsQuery);

    useEffect(() => {
        if (userData?.user) {
            setRoot(userData.user.organisationUnits[0].id);
            setUser(userData.user.username);
            setGroups(userData.user.userGroups.map(ug => ug.displayName));

            const userGroupsMemberships = userData.user.userGroups
            if (userGroupsMemberships.length > 0) {
                const isAdmin = userGroupsMemberships.some(member => APP_GROUP === member.name);
                setSelectedIsAdmin(isAdmin);
                const isFacilitator = userGroupsMemberships.some(member => FACILITATOR_GROUP === member.name);
                setSelectedIsFacilitator(isFacilitator);
                const isMEL = userGroupsMemberships.some(member => MEL_TEAM_GROUP === member.name);
                setSelectedIsMEL(isMEL);
            }
        }
    }, [userData])

    useEffect(() => {
        if (dataStore?.dataStore?.entries) {
            const entry = dataStore.dataStore.entries.find(e => e.key === `${config.dataStoreKey}`);
            if (entry) {
                setNameAttributes(entry.value.nameAttributes || []);
                setTrainingProgram(entry.value.trainingProgram);
                setGroupEdit(entry.value.groupEdit);
                setEventNameAttribute(entry.value.eventNameAttribute);
            }
        }
    }, [dataStore, trainingProgram]);

    useEffect(() => {
        if (elementsData && elementsData.programStage && elementsData.programStage.programStages) {
            const stages = elementsData.programStage.programStages.map(stage => {
                return {
                    id: stage.id,
                    repeatable: stage.repeatable
                }
            });
            setStages(stages);
            const dataElements = elementsData.programStage.programStages.flatMap(ps => ps.programStageDataElements.map(data => data.dataElement));
            setDataElements(dataElements);
        }
        setOriginalEdits([]);
        setEdits([]);
    }, [elementsData]);

    useEffect(() => {
        if (stagesDataElements) {
            const data = stagesDataElements.dataElements.programStages.map(ps => {
                return {
                    stage: ps.id,
                    dataElements: ps.programStageDataElements.flatMap(psde => psde.dataElement.id)
                }
            })
            setStageDataElements(data)
        }
    }, [stagesDataElements]);

    useEffect(() => {
        if (trainingProgram && root) {
            setEventsLoading(true);

            engine.query({
                trainings: {
                    resource: 'tracker/trackedEntities',
                    params: {
                        program: trainingProgram,
                        ouMode: 'DESCENDANTS',
                        paging: false,
                        fields: 'attributes,trackedEntity,orgUnit(displayName)',
                        orgUnit: root
                    }
                }
            }).then(res => {
                if (res && res.trainings) {
                    const filteredTrainings = res.trainings.trackedEntities.filter(training => {
                        const facilitatorMatches = training.attributes.some(attr => {
                            const facilitators = attr.attribute === EVENT_OPTIONS.attributes.facilitators && attr.value;
                            return facilitators && facilitators.split(',').includes(user);
                        });
                        if (groups.includes(MEL_TEAM_GROUP) || groups.includes(APP_GROUP)) {
                            return true;
                        }
                        return facilitatorMatches;
                    });

                    const trainings = new Set(filteredTrainings.flatMap(i => {
                        return i.attributes.map(attr => {
                            attr['trackedEntity'] = i.trackedEntity;
                            attr['orgUnit'] = i.orgUnit;
                            return attr;
                        })
                    }).filter(attr => attr.attribute === eventNameAttribute).map(attr => {
                        return {
                            id: attr.trackedEntity,
                            label: attr.value,
                            orgUnit: attr.orgUnit
                        }
                    }));
                    setTrainings(Array.from(trainings));
                }

                setEventsLoading(false);
            })
        }

    }, [trainingProgram, root])

    useEffect(() => {
        pageParticipants();
    }, [entities, page, pageSize]);

    useEffect(() => {
        if (selectedTraining) {
            setLoading(true);
            setEntities([]);
            setStartDate(null);
            setEndDate(null);

            const orgUnit = trainings.find(training => training.id === selectedTraining)?.orgUnit
            if (orgUnit) {
                const venue = orgUnits.find(ou => ou.id === orgUnit)?.displayName;
                setVenue(venue);
            }

            engine.query({
                training: {
                    resource: `tracker/trackedEntities/${selectedTraining}`,
                    params: {
                        fields: 'trackedEntity,attributes,relationships(from(trackedEntity(trackedEntity)))',
                        program: trainingProgram
                    }
                }
            }).then(async (res) => {
	            if (res && res.training) {
		            setEventAttributes(res.training.attributes);

		            const rels = await engine.query({
			            relationships: {
				            resource: `tracker/relationships`,
				            params: {
					            tei: res.training.trackedEntity,
				            }
			            }
		            });

		            const ids = rels.relationships.relationships.map(rel => rel.from.trackedEntity.trackedEntity);
					console.log('IDs', ids);
		            if (ids.length > 0) {
			            fetchEntities(engine, ids, '*').then(value => {
				            const attendees = sortEntities(value.map(v => v.entity), nameAttributes);
				            setAllEntities(attendees);
				            setPage(1)
				            setEntities(prev => [...attendees]);

				            setLoading(false)
			            });
		            } else {
                        setLoading(false);
                    }

                    res.training.attributes.forEach(attr => {
                        if (attr.attribute === EVENT_OPTIONS.attributes.startDate) {
                            setStartDate(attr.value)
                        } else if (attr.attribute === EVENT_OPTIONS.attributes.endDate) {
                            setEndDate(attr.value)
                        }

                        if (attr.attribute === EVENT_OPTIONS.attributes.activity) {
                            let selectedStage = '';
                            switch (+attr.value) {
                                case 1:
                                    selectedStage = ACTIVITY_STAGE_MAPPING[1];
                                    break;
                                case 2:
                                    selectedStage = ACTIVITY_STAGE_MAPPING[2];
                                    break;
                                case 3:
                                    selectedStage = ACTIVITY_STAGE_MAPPING[3];
                                    break;
                                default:
                                    selectedStage = ACTIVITY_STAGE_MAPPING[1];
                            }

                            setSelectedStage(selectedStage);
                        }
                        if (attr.attribute === EVENT_OPTIONS.attributes.event) {
                            setEventName(attr.value)
                        }
                    })
                }
            })
        }
    }, [selectedTraining])

    useEffect(() => {
        if (orgUnitsData && orgUnitsData.orgUnits) {
            setOrgUnits(orgUnitsData.orgUnits.organisationUnits);
        }
    }, [orgUnitsData]);

    useEffect(() => {
        setGroupValues({});
    }, [groupEdit]);

    useEffect(() => {
        const adjustScrollHeight = () => {
            const height = window.innerHeight;
            if (height < 800) {
                setScrollHeight('350px');
            } else {
                setScrollHeight('700px');
            }
        };

        // Adjust scrollHeight initially
        adjustScrollHeight();

        // Add event listener to adjust on resize
        window.addEventListener('resize', adjustScrollHeight);

        // Clean up event listener on component unmount
        return () => {
            window.removeEventListener('resize', adjustScrollHeight);
        };
    }, []);

    const pageParticipants = () => {
        const currentPage = paginate(entities, page, pageSize);
        setPagedParticipants(prev => [...currentPage]);
    }

    const groupDataElementValue = (dataElement) => {
        return groupValues[dataElement];
    }

    const datePart = (date) => {
        const regex = /^\d{4}-\d{2}-\d{2}/; // Matches YYYY-MM-DD at the beginning
        const match = date?.match(regex);

        if (match) {
            return match[0];
        }
        return '';
    }

    const dataElementValue = (date, dataElement, entity) => {
        const mapping = EVENT_OPTIONS.stageMapping.find(sm => sm.id === selectedStage);
        let event = entity.enrollments[0].events?.find(event => {
            const match = event.programStage === selectedStage;
            if (match) {
                return event.dataValues?.some(dv => dv.dataElement === mapping.mappings[EVENT_OPTIONS.attributes.event]
                    && dv.value === eventName)
            }
            return match;
        });
        const activeEvent = entity.enrollments[0].events?.find(event => event.programStage === selectedStage);
        const editedEntity = edits.find(edit => edit.entity.trackedEntity === entity.trackedEntity);

        const repeatable = stages.find(stage => stage.id === selectedStage)?.repeatable;
        if (activeEvent && !repeatable) {
            event = activeEvent;
        }
        if (event) {
            let value;
            if (editedEntity && editedEntity.values.some(v => datePart(v.date) === datePart(date) && v.dataElement.id === dataElement)) {
                value = editedEntity.values.find(value => value.dataElement.id === dataElement && datePart(date) === datePart(value.date))?.value;
            } else {
                value = event.dataValues.find(dv => dv.dataElement === dataElement)?.value;
            }
            return (value ?? '') + '';

        } else if (editedEntity) {
            return (editedEntity.values.find(value => value.dataElement.id === dataElement && datePart(date) === datePart(value.date))?.value ?? '') + '';
        }
        return null;
    }

    const saveEdits = () => {
        setSaving(true);

        const events = [];

        const filterValues = (values, formattedDate) => {
            return values.filter(value => datePart(value.date) === formattedDate);
        }

        const _edits = edits;
        //If group action and an entity has been selected and not edited, add it here
        if (groupEdit) {
            selectedEntities.forEach(entity => {
                if (!edits.find(edit => edit.entity.trackedEntity === entity.trackedEntity)) {
                    _edits.push({
                            entity,
                            values: [{
                                date: startDate
                            }]
                        }
                    );
                }
            })
        }

        const dataElements = stageDataElements.find(sde => sde.stage === selectedStage)?.dataElements;
        const repeatable = stages.find(stage => stage.id === selectedStage)?.repeatable;

        //Loop through each edit records and recreate event data for
        _edits.forEach(edit => {
            Map.groupBy(edit.values, ({date}) => datePart(date)).keys().forEach(eventDate => {
                let event = edit.entity?.enrollments[0].events?.find(event => {
                    const mapping = EVENT_OPTIONS.stageMapping.find(sm => sm.id === selectedStage);
                    const match = event.programStage === selectedStage;
                    if (match) {
                        return event.dataValues?.some(dv => dv.dataElement === mapping.mappings[EVENT_OPTIONS.attributes.event]
                            && dv.value === eventName)
                    }
                    return match;
                });
                const values = filterValues(edit.values, eventDate);

                if (!event) {
                    const existingEvent = edit.entity.enrollments[0].events?.find(event => event.programStage === selectedStage);
                    if (existingEvent && !repeatable) {
                        event = existingEvent;
                        event.dataValues = filterDataValues(dataElements, event.dataValues);
                    } else {
                        event = {
                            programStage: selectedStage,
                            enrollment: edit.entity.enrollments[0].enrollment,
                            trackedEntity: edit.entity.trackedEntity,
                            orgUnit: edit.entity.orgUnit,
                            occurredAt: values[0].date,
                            dataValues: []
                        }
                    }
                }

                values.forEach(value => {
                    if (value.dataElement) {
                        const dataValue = event.dataValues.find(dv => dv.dataElement === value.dataElement.id) || {};
                        dataValue.dataElement = value.dataElement.id;
                        dataValue.value = (value.value ?? '') + '';
                        if (value.dataElement.valueType === 'TRUE_ONLY' && !value.value) {
                            dataValue.value = null;
                        }
                        if (value.dataElement.valueType.includes('DATE')) {
                            dataValue.value = value.value ? new Date(value.value).toISOString() : '';
                        }

                        const dataValues = event.dataValues.filter(dv => dv.dataElement !== value.dataElement.id) || [];
                        dataValues.push(dataValue);
                        event.dataValues = dataValues;
                    }
                });

                const attributes = eventAttributes.map(attr => {
                    const mapping = EVENT_OPTIONS.stageMapping.find(sm => sm.id === selectedStage);
                    return {
                        dataElement: mapping.mappings[attr.attribute],
                        value: attr.value
                    }
                }).filter(v => v.dataElement && v.dataElement.length > 0)

                attributes.push(...Object.keys(groupValues).map(key => {
                    return {
                        dataElement: key,
                        value: groupValues[key]
                    }
                }));

                const mapping = EVENT_OPTIONS.stageMapping.find(sm => sm.id === selectedStage);
                attributes.push({
                    dataElement: mapping.venue,
                    value: venue
                })

                attributes.forEach(de => {
                    const dataValue = event.dataValues.find(dv => dv.dataElement === de.dataElement) || {};
                    dataValue.dataElement = de.dataElement;
                    dataValue.value = (de.value ?? '') + '';
                    const valueType = dataElements.find(d => d.id === de.dataElement)?.valueType ?? '';
                    if (valueType === 'TRUE_ONLY' && !de.value) {
                        dataValue.value = null;
                    }
                    if (valueType.includes('DATE')) {
                        dataValue.value = de.value ? new Date(de.value).toISOString() : '';
                    }

                    const dataValues = event.dataValues.filter(dv => dv.dataElement !== de.dataElement) || [];
                    dataValues.push(dataValue);
                    event.dataValues = filterDataValues(dataElements, dataValues);
                })

                events.push(event);
            });
        });

        trackerCreate(engine, {events}).then((response) => {
            if (response) {
                setEdits([]);
                fetchEntities(engine, entities.map(e => e.trackedEntity), '*').then(value => {
                    const attendees = sortEntities(value.map(v => v.entity), nameAttributes);
                    setAllEntities(attendees);
                    setSaving(false);
                    setPage(1);
                    setEntities(prev => [...attendees]);
                });
                show({msg: i18n.t('Attendance successfully updated'), type: 'success'});
            } else {
                show({msg: i18n.t('There was an error updating attendance'), type: 'error'});
                setSaving(false);
            }
        });
    }

    // eslint-disable-next-line max-params
    const createOrUpdateEvent = (entity, date, dataElement, value) => {
        if (dataElement.valueType.includes('INTEGER')) {
            value = parseInt(value);
            if (dataElement.valueType === 'INTEGER_ZERO_OR_POSITIVE' && parseInt(value) < 0) {
                alert('Please enter a non-negative integer');
                return;
            }
            if (dataElement.valueType === 'INTEGER_POSITIVE' && parseInt(value) <= 0) {
                alert('Please enter a number greater than 0');
                return;
            }
            if (dataElement.valueType === 'INTEGER_NEGATIVE' && parseInt(value) >= 0) {
                alert('Please enter a number less than 0');
                return;
            }
        }
        const _edits = edits.filter(edit => edit.entity.trackedEntity !== entity.trackedEntity);
        let currentEdit = edits.find(edit => edit.entity.trackedEntity === entity.trackedEntity);
        const originalEdit = originalEdits.find(edit => edit.entity.trackedEntity === entity.trackedEntity);
        if (!currentEdit) {
            currentEdit = {
                entity,
                values: []
            };
        }
        const values = currentEdit.values.filter(v => !(v.dataElement.id === dataElement.id && datePart(date) === datePart(v.date)));
        values.push({
            value,
            dataElement,
            date
        });
        currentEdit.values = values;

        const values2 = [...values];
        const values1 = [...(Object.assign({}, originalEdits.find(edit => edit.entity.trackedEntity === entity.trackedEntity))?.values ?? [])];
        const editChanged = () => {
            if (values2.length !== values1.length) {
                return true;
            }
            return values1.some(value => {
                const match = values2.find(v => v.dataElement.id === value.dataElement.id && datePart(v.date) === datePart(value.date));
                if (!match) {
                    return true;
                }
                if (value.dataElement.valueType === 'TRUE_ONLY' || value.dataElement.valueType === 'BOOLEAN') {
                    return !match.value !== !value.value;
                }
                return ((match.value ?? '') + '') !== ((value.value ?? '') + '');

            })
        }

        if (originalEdit?.entity.trackedEntity !== currentEdit.entity.trackedEntity || editChanged()) {
            _edits.push(currentEdit);

            if (!originalEdit) {
                setOriginalEdits([...originalEdits, {...currentEdit}]);
            } else {
                const _originalEdits = originalEdits.filter(edit => edit.entity.trackedEntity !== entity.trackedEntity);
                const oldValues = {...originalEdit}.values.filter(v => v.dataElement.id === dataElement.id && datePart(v.date) === datePart(date));
                const newValues = currentEdit.values.filter(v => !(v.dataElement.id === dataElement.id && datePart(v.date) === datePart(date)));
                oldValues.push(...newValues);
                setOriginalEdits([..._originalEdits, Object.assign({}, originalEdit, {values: oldValues})]);
            }
        }

        setEdits(_edits);
    }

    const createOrUpdateIndividualEvent = (entity, dataElement, value) => {
        createOrUpdateEvent(entity, startDate, dataElement, value);
    }

    const createOrUpdateGroupEvent = (dataElement, value) => {
        setGroupValues(prevValues => ({
            ...prevValues,
            [dataElement.id]: value,
        }));
    }

    const individualDataElementsForDates = () => {
        const configuredDataElements = [];
        const days = EVENT_OPTIONS.stageMapping.find(s => s.id === selectedStage)?.days;
        if (days) {
            for (let i = 1; i <= daysBetween(new Date(startDate), new Date(endDate)); i++) {
                configuredDataElements.push(days[i])
            }
        }

        return configuredDataElements;
    }

    const search = (keyword) => {
        if (keyword && keyword.length > 0) {
            const entities = searchEntities(keyword, allEntities, nameAttributes);
            setEntities(entities);
        } else {
            setEntities(allEntities);
        }
    }

    const downloadAttendance = () => {
        prepareAndDownloadAttendance(entities, orgUnits, nameAttributes);
    }

    return (!(selectedSharedIsMEL || selectedSharedIsFacilitator || selectedSharedIsAdmin) ? <NotFoundPage/> : (
        <>
            <div className="flex flex-row w-full h-full">
                <div className="page">
                    <Navigation/>
                    <div className="p-6">
                        <div className="mx-auto w-full">
                            <div className="w-full flex flex-col">
                                <div className="flex flex-col card w-full">
                                    <>
                                        <div className="w-full border-b-2 border-blue-500 p-2">
                                            <TrainingsComponent trainings={trainings}
                                                                program={trainingProgram}
                                                                loading={eventsLoading}
                                                                trainingSelected={(training) => setSelectedTraining(training)}/>
                                        </div>
                                        {entities.length > 0 &&
                                            <div className="card p-2 pt-4">
                                                <div
                                                    className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={groupEdit === true}
                                                        onChange={(payload) => {
                                                            setGroupEdit(payload.target.checked);
                                                        }}
                                                        className="checkbox"/>
                                                    <label
                                                        className="label pl-2 pt-2">
                                                        {i18n.t('Group Action?')}
                                                    </label>
                                                </div>
                                            </div>
                                        }
                                        <div className="flex flex-col w-full mb-2">
                                            {groupEdit && entities.length > 0 &&
                                                <div className="card">
                                                    <div className="flex flex-col w-6/12 p-6">
                                                        <label htmlFor="program"
                                                               className="label pb-2">
                                                            Attendance
                                                        </label>
                                                        <div className="border border-blue-500 mb-2">
                                                            <label className="label pl-2 pt-2 text-sm italic">
                                                                Select at least 1 attendee to enable days
                                                            </label>
                                                        </div>
                                                        {individualDataElementsForDates().map((id) => {
                                                            const de = dataElements.find(e => e.id === id)
                                                            return <>
                                                                {de && <div
                                                                    className="flex flex-col my-auto pl-4 w-3/12">
                                                                    <DataElementComponent
                                                                        value={groupDataElementValue(de.id)}
                                                                        dataElement={de}
                                                                        readonly={selectedEntities.length === 0}
                                                                        valueChanged={(d, v) => {
                                                                            createOrUpdateGroupEvent(de, v)
                                                                        }
                                                                        }
                                                                    />
                                                                </div>
                                                                }
                                                            </>
                                                        })}
                                                    </div>
                                                </div>
                                            }
                                        </div>
                                    </>
                                </div>
                                <div className="w-full flex flex-col pt-2">
                                    <div className="p-8 mt-6 lg:mt-0 rounded shadow bg-white">
                                        <div
                                            className={loading ? 'opacity-20 relative overflow-x-auto shadow-md sm:rounded-lg' : 'relative overflow-x-auto shadow-md sm:rounded-lg'}>
                                            {loading &&
                                                <SpinnerComponent/>
                                            }
                                            <div className="flex flex-row">
                                                {entities.length > 0 &&
                                                    <div className="w-3/12">
                                                        <SearchComponent search={(value) => search(value)}/>
                                                    </div>
                                                }
                                                <div className="flex flex-row justify-end w-full">
                                                    {entities.length > 0 &&
                                                        <button type="button"
                                                                onClick={downloadAttendance}
                                                                className="primary-btn"
                                                        >
                                                            Download attendance
                                                        </button>
                                                    }
                                                </div>
                                            </div>
                                            <table
                                                className="w-full text-sm text-left rtl:text-right text-gray-500 ">
                                                <caption
                                                    className="p-5 text-lg font-semibold text-left rtl:text-right text-gray-900 bg-white">
                                                    <p className="mt-1 text-sm font-normal text-gray-500 ">

                                                    </p>
                                                    <div className="flex flex-row justify-end">
                                                        {((groupEdit && !isObjectEmpty(groupValues) && selectedEntities.length > 0) || (!groupEdit && edits.length > 0)) &&
                                                            <button type="button"
                                                                    className={loading || saving ? 'primary-btn-disabled' : 'primary-btn'}
                                                                    onClick={saveEdits}>
                                                                <div
                                                                    className="flex flex-row">
                                                                    {(saving || loading) &&
                                                                        <div
                                                                            className="pr-2">
                                                                            <SpinnerComponent/>
                                                                        </div>
                                                                    }
                                                                    <span> Save Attendance</span>
                                                                </div>
                                                            </button>
                                                        }
                                                    </div>
                                                </caption>
                                                <thead
                                                    className="text-xs text-gray-700 uppercase bg-gray-50 ">
                                                {!groupEdit && entities.length > 0 &&
                                                    <tr>
                                                        <td colSpan={groupEdit ? 4 : 3}
                                                            rowSpan={1}></td>
                                                        {individualDataElementsForDates().map((id, idx) => {
                                                            const de = dataElements.find(e => e.id === id)
                                                            return <th key={idx}
                                                                       rowSpan={5}
                                                                       style={{width: `${41.66 / daysBetween(new Date(startDate), new Date(endDate))}%`}}
                                                                       className="py-3 h-48">
                                                                        <span
                                                                            className="whitespace-nowrap block text-left -rotate-90 w-16 pb-4">{de?.name}</span>
                                                            </th>
                                                        })}
                                                    </tr>
                                                }
                                                <tr>
                                                    {groupEdit &&
                                                        <th className="px-6 py-6 w-1/12">
                                                            <div
                                                                className="flex items-center mb-4">
                                                                <input
                                                                    type="checkbox"
                                                                    onChange={(event) => {
                                                                        if (event.target.checked) {
                                                                            setSelectedEntities(entities)
                                                                        } else {
                                                                            setSelectedEntities([])
                                                                            setEdits([])
                                                                        }
                                                                    }}
                                                                    checked={selectedEntities.length === entities.length}
                                                                    className="checkbox"/>
                                                            </div>
                                                        </th>
                                                    }
                                                    <th data-priority="1" className="px-6 py-3 w-1/12">#
                                                    </th>
                                                    <th data-priority="2"
                                                        className="px-6 py-3 w-3/12">Profile
                                                    </th>
                                                    <th data-priority="2"
                                                        className="px-6 py-3 w-2/12">Org Unit
                                                    </th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {pagedParticipants.map((entity, index) => {
                                                    return <>
                                                        <tr className="pr-3 text-right odd:bg-white even:bg-gray-50 ">
                                                            {groupEdit &&
                                                                <td className="px-6 py-6">
                                                                    <div
                                                                        className="flex items-center mb-4">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedEntities.map(e => e.trackedEntity).includes(entity.trackedEntity)}
                                                                            onChange={() => {
                                                                                if (selectedEntities.map(e => e.trackedEntity).includes(entity.trackedEntity)) {
                                                                                    setSelectedEntities(selectedEntities.filter(rowId => rowId.trackedEntity !== entity.trackedEntity));
                                                                                    //setEdits(edits.filter(edit => edit.entity.trackedEntity !== entity.trackedEntity))
                                                                                } else {
                                                                                    setSelectedEntities([...selectedEntities, entity]);

                                                                                    /*let currentEdit = edits.find(edit => edit.entity.trackedEntity === entity.trackedEntity);
                                                                                    if (!currentEdit) {
                                                                                        currentEdit = {
                                                                                            entity
                                                                                        };
                                                                                    }
                                                                                    const sample = edits[0];
                                                                                    if (sample) {
                                                                                        currentEdit.values = sample.values;

                                                                                        setEdits([...edits, currentEdit]);
                                                                                    }*/
                                                                                }
                                                                            }}
                                                                            className="checkbox"/>
                                                                    </div>
                                                                </td>
                                                            }
                                                            <td>{index + 1}</td>
                                                            <td className="text-left px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{getParticipant(entity, nameAttributes)}</td>
                                                            <td className="text-left px-6 py-4 font-medium text-gray-900 whitespace-nowrap ">{orgUnits.find(ou => ou.id === entity.orgUnit)?.displayName}</td>
                                                            {!groupEdit && entities.length > 0 && dataElements.length > 0 && individualDataElementsForDates().map((cde, idx2) => {
                                                                const de = dataElements.find(de => de.id === cde);
                                                                return <>
                                                                    <td>
                                                                        <div
                                                                            className="flex flex-col my-auto pl-4">
                                                                            <DataElementComponent
                                                                                key={idx2}
                                                                                value={dataElementValue(startDate, de.id, entity)}
                                                                                dataElement={de}
                                                                                labelVisible={false}
                                                                                valueChanged={(d, v) => {
                                                                                    createOrUpdateIndividualEvent(entity, de, v)
                                                                                }}/>
                                                                        </div>
                                                                    </td>
                                                                </>
                                                            })}
                                                        </tr>
                                                    </>
                                                })}
                                                </tbody>
                                                <tfoot>
                                                <tr>
                                                    <th className="w-full p-2"
                                                        colSpan={!groupEdit ? daysBetween(startDate, endDate) + 4 : 4}>
                                                        <div
                                                            className="flex flex-row w-full justify-end">
                                                            <Pagination
                                                                page={page}
                                                                pageCount={Math.ceil(entities.length / pageSize)}
                                                                pageSize={pageSize}
                                                                total={entities.length}
                                                                onPageChange={(page) => setPage(page)}
                                                                onPageSizeChange={(size) => {
                                                                    setPage(1);
                                                                    setPageSize(size);
                                                                }}
                                                            />
                                                        </div>
                                                    </th>
                                                </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    ))
}
