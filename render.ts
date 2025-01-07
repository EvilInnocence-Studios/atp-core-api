import React from 'react';
import { renderToStaticMarkup } from "react-dom/server";

export const render = <Props extends {}>(Component:React.FunctionComponent<Props>, props?:(React.Attributes & Props) | null) =>
    renderToStaticMarkup(
        React.createElement(Component, props)
    );
    