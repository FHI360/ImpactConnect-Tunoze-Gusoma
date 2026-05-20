import { useDataQuery } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n';
import PropTypes from 'prop-types';
import React from 'react'
import { SingleSelectField } from '@dhis2/ui';
import { SingleSelectOption } from '@dhis2-ui/select';

/*  Query Parameters**/
const query = {
    programsMetadata: {
        resource: 'programs',
        params: {
            // pageSize: 5,
            fields: ['id', 'displayName'],
        },
    }
}

const ProgramComponent = ({selectedProgram, setSelectedProgram, disabled, label}) => {

    const {error: error, data: data} = useDataQuery(query);

    if (error) {
        return <span>ERROR: {error.message}</span>
    }

    const handleProgramChange = event => {
        //event.preventDefault();
        setSelectedProgram(event.selected);
    };

    return (
        <div>
            <label htmlFor="program" className="block mb-2 text-sm font-medium text-gray-900 ">
                {label || i18n.t('Select program')}
            </label>
            {data?.programsMetadata?.programs.length && <SingleSelectField
                id="program"
                className="w-full"
                selected={selectedProgram}
                disabled={disabled}
                placeholder={'Choose a program'}
                clearable={true}
                filterable={true}
                onChange={handleProgramChange}>
                {data?.programsMetadata?.programs.map(({id, displayName}) => (
                        <SingleSelectOption label={displayName} value={id} key={id}/>
                    )
                )}
            </SingleSelectField>}
        </div>
    )
}
export default ProgramComponent

ProgramComponent.propTypes = {
    disabled: PropTypes.bool,
    label: PropTypes.string,
    selectedProgram: PropTypes.string,
    setSelectedProgram: PropTypes.func
};
